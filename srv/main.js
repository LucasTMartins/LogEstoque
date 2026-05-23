'use strict';

const cds  = require('@sap/cds');
const rules = require('./moviment-rules');

module.exports = class MainService extends cds.ApplicationService {

    async init() {

        const { Moviments, Stocks, StockHistory } = cds.entities('db.inventory');
        const { Warehouses, Materials }           = cds.entities('db.masterdata');

        // ── Cadastro de materiais ───────────────────────────────────────────

        this.before('CREATE', 'Materials', (req) => {
            if (req.data.active === undefined || req.data.active === null)
                req.data.active = true;
        });

        this.on('DELETE', 'Materials', async (req) => {
            const { ID } = req.params[0];
            const material = await SELECT.one.from(Materials).where({ ID });
            if (!material) return req.error(404, 'Material não encontrado');
            await UPDATE(Materials).set({ active: false }).where({ ID });
            return req.reply();
        });

        // ── Value help de unidades de medida ───────────────────────────────

        const UNIT_MEASURES = [
            { codigo: 'UN',  descricao: 'Unidade'        },
            { codigo: 'KG',  descricao: 'Quilograma'      },
            { codigo: 'M',   descricao: 'Metro'           },
            { codigo: 'L',   descricao: 'Litro'           },
            { codigo: 'PC',  descricao: 'Peça'            },
            { codigo: 'CX',  descricao: 'Caixa'           },
            { codigo: 'PCT', descricao: 'Pacote'          },
            { codigo: 'MT',  descricao: 'Metro'           },
            { codigo: 'M2',  descricao: 'Metro Quadrado'  },
            { codigo: 'M3',  descricao: 'Metro Cúbico'    },
            { codigo: 'LT',  descricao: 'Litro'           },
            { codigo: 'ML',  descricao: 'Mililitro'       },
            { codigo: 'G',   descricao: 'Grama'           },
            { codigo: 'T',   descricao: 'Tonelada'        },
            { codigo: 'SC',  descricao: 'Saco'            },
            { codigo: 'FD',  descricao: 'Fardo'           },
            { codigo: 'BL',  descricao: 'Bloco'           },
            { codigo: 'GL',  descricao: 'Galão'           },
            { codigo: 'PAR', descricao: 'Par'             },
            { codigo: 'RL',  descricao: 'Rolo'            },
            { codigo: 'CP',  descricao: 'Corpo'           },
            { codigo: 'FRD', descricao: 'Fardo'           },
            { codigo: 'BRT', descricao: 'Bruto'           },
            { codigo: 'DZ',  descricao: 'Dúzia'           },
            { codigo: 'CJS', descricao: 'Conjunto'        },
            { codigo: 'PRC', descricao: 'Porção'          },
            { codigo: 'TD',  descricao: 'Todo'            },
            { codigo: 'RES', descricao: 'Resma'           },
            { codigo: 'TP',  descricao: 'Tipo'            },
            { codigo: 'JG',  descricao: 'Jogo'            },
        ];

        this.on('READ', 'UnitMeasuresVH', () => UNIT_MEASURES);

        this.on('READ', 'CurrentUser', (req) => {
            const roles = req.user?.roles ?? [];
            return [{ dummy: '1', canManageMaterials: roles.includes('ESTOQUE') || roles.includes('ADMIN') }];
        });

        // ── Criação de movimentação ─────────────────────────────────────────

        this.before('CREATE', 'Moviments', async (req) => {
            const data   = req.data;
            const errors = rules.validateNewMoviment(data);
            if (errors.length > 0) return req.error(400, errors.join('; '));

            // Status inicial sempre Pendente — usuário não pode definir
            req.data.status = rules.STATUS.P;

            // Material deve existir e estar ativo
            const material = await SELECT.one.from(Materials).where({ ID: data.material_ID });
            const matErr   = rules.validateMaterialActive(material);
            if (matErr) return req.error(422, matErr);

            // Armazém destino deve estar ativo
            const destWh  = await SELECT.one.from(Warehouses).where({ ID: data.destinationWarehouse_ID });
            const destErr = rules.validateWarehouseActive(destWh, 'destino');
            if (destErr) return req.error(422, destErr);

            // Para Saída: armazém origem ativo + estoque suficiente pré-existente
            if (data.type === rules.TYPE.S) {
                const origWh  = await SELECT.one.from(Warehouses).where({ ID: data.originWarehouse_ID });
                const origErr = rules.validateWarehouseActive(origWh, 'origem');
                if (origErr) return req.error(422, origErr);

                const stock    = await SELECT.one.from(Stocks).where({
                    material_ID:  data.material_ID,
                    warehouse_ID: data.originWarehouse_ID,
                });
                const stockErr = rules.validateStockForSaida(stock, data.quantity);
                if (stockErr) return req.error(409, stockErr);
            }
        });

        // ── Ação: Aprovar ───────────────────────────────────────────────────

        this.on('approve', 'Moviments', async (req) => {
            const { ID } = req.params[0];

            const moviment = await SELECT.one.from(Moviments).where({ ID });
            if (!moviment) return req.error(404, `Movimentação não encontrada`);

            if (!rules.validateStatusTransition(moviment.status, rules.STATUS.A)) {
                return req.error(
                    409,
                    `Não é possível aprovar uma movimentação com status '${moviment.status}'`
                );
            }

            // Saída: verificar estoque disponível no armazém de origem
            if (moviment.type === rules.TYPE.S) {
                const stocks = await SELECT.from(Stocks).where({
                    warehouse_ID: moviment.originWarehouse_ID,
                    material_ID:  moviment.material_ID,
                });
                if (!rules.checkStockAvailability(
                    moviment.originWarehouse_ID,
                    moviment.material_ID,
                    moviment.quantity,
                    stocks
                )) {
                    return req.error(409, 'Estoque insuficiente no armazém de origem para esta saída');
                }
            }

            // Entrada: verificar capacidade do armazém destino
            if (moviment.type === rules.TYPE.E) {
                const [stocks, warehouses] = await Promise.all([
                    SELECT.from(Stocks).where({ warehouse_ID: moviment.destinationWarehouse_ID }),
                    SELECT.from(Warehouses).where({ ID: moviment.destinationWarehouse_ID }),
                ]);
                if (!rules.checkWarehouseCapacity(
                    moviment.destinationWarehouse_ID,
                    moviment.quantity,
                    stocks,
                    warehouses
                )) {
                    return req.error(409, 'A quantidade excederia a capacidade do armazém destino');
                }
            }

            await UPDATE(Moviments).set({ status: rules.STATUS.A }).where({ ID });
            return SELECT.one.from(Moviments).where({ ID });
        });

        // ── Ação: Concluir (atualiza estoque) ──────────────────────────────

        this.on('conclude', 'Moviments', async (req) => {
            const { ID } = req.params[0];

            const moviment = await SELECT.one.from(Moviments).where({ ID });
            if (!moviment) return req.error(404, `Movimentação não encontrada`);

            if (!rules.validateStatusTransition(moviment.status, rules.STATUS.C)) {
                return req.error(
                    409,
                    `Não é possível concluir uma movimentação com status '${moviment.status}'`
                );
            }

            if (moviment.type === rules.TYPE.S) {
                await _updateStock(
                    Stocks, StockHistory,
                    moviment.material_ID,
                    moviment.originWarehouse_ID,
                    -moviment.quantity,
                    ID
                );
            } else {
                await _updateStock(
                    Stocks, StockHistory,
                    moviment.material_ID,
                    moviment.destinationWarehouse_ID,
                    +moviment.quantity,
                    ID
                );
            }

            await UPDATE(Moviments).set({ status: rules.STATUS.C }).where({ ID });
            return SELECT.one.from(Moviments).where({ ID });
        });

        // ── Ação: Rejeitar ──────────────────────────────────────────────────

        this.on('rejectMoviment', 'Moviments', async (req) => {
            const { ID }     = req.params[0];
            const { reason } = req.data;

            if (!reason || !reason.trim()) {
                return req.error(400, 'Motivo da rejeição é obrigatório');
            }

            const moviment = await SELECT.one.from(Moviments).where({ ID });
            if (!moviment) return req.error(404, `Movimentação não encontrada`);

            if (!rules.validateStatusTransition(moviment.status, rules.STATUS.R)) {
                return req.error(
                    409,
                    `Não é possível rejeitar uma movimentação com status '${moviment.status}'`
                );
            }

            await UPDATE(Moviments)
                .set({ status: rules.STATUS.R, observation: reason.trim() })
                .where({ ID });

            return SELECT.one.from(Moviments).where({ ID });
        });

        // ── Value helps para enums (dados estáticos) ───────────────────────

        const MOVIMENT_TYPES = [
            { codigo: 'E', descricao: 'Entrada' },
            { codigo: 'S', descricao: 'Saída'   },
        ];

        const MOVIMENT_STATUS = [
            { codigo: 'P', descricao: 'Pendente'  },
            { codigo: 'A', descricao: 'Aprovado'  },
            { codigo: 'R', descricao: 'Rejeitado' },
            { codigo: 'C', descricao: 'Concluído' },
        ];

        this.on('READ', 'MovimentTypesVH',  () => MOVIMENT_TYPES);
        this.on('READ', 'MovimentStatusVH', () => MOVIMENT_STATUS);

        this.before('READ', 'Moviments', (req) => {
            const w = req.query?.SELECT?.where;
            if (w) req.query.SELECT.where = _expandDateFilters(w);
        });

        this.after('READ', 'Moviments', (results) => {
            const rows = Array.isArray(results) ? results : [results];
            rows.forEach(row => {
                if (row.createdAt)  row.createdAt  = row.createdAt.slice(0, 10);
                if (row.modifiedAt) row.modifiedAt = row.modifiedAt.slice(0, 10);
            });
        });

        await super.init();
    }

};

// ── Filtros de data: converte eq de data em range do dia inteiro ───────────────

const _DATE_FIELDS = new Set(['createdAt', 'modifiedAt']);
const _DATE_MATCH  = /^(\d{4}-\d{2}-\d{2})(?:T[\d:.]+Z)?$/;

function _expandDateFilters(where) {
    if (!Array.isArray(where)) return where;
    const out = [];
    for (let i = 0; i < where.length; i++) {
        const token = where[i];
        const match = token?.ref && _DATE_FIELDS.has(token.ref[0]) &&
                      where[i + 1] === '=' &&
                      typeof where[i + 2]?.val === 'string' &&
                      where[i + 2].val.match(_DATE_MATCH);
        if (match) {
            const field   = token.ref[0];
            const date    = match[1];
            const nextDay = new Date(`${date}T00:00:00.000Z`);
            nextDay.setUTCDate(nextDay.getUTCDate() + 1);
            const next    = nextDay.toISOString().slice(0, 10);
            out.push(
                { ref: [field] }, '>=', { val: `${date}T00:00:00.000Z` },
                'and',
                { ref: [field] }, '<',  { val: `${next}T00:00:00.000Z` }
            );
            i += 2;
        } else if (Array.isArray(token)) {
            out.push(_expandDateFilters(token));
        } else if (token?.xpr) {
            out.push({ ...token, xpr: _expandDateFilters(token.xpr) });
        } else {
            out.push(token);
        }
    }
    return out;
}

// ── Função auxiliar: atualizar estoque e criar histórico ───────────────────────

async function _updateStock(Stocks, StockHistory, material_ID, warehouse_ID, delta, moviment_ID) {
    const stock = await SELECT.one.from(Stocks).where({ material_ID, warehouse_ID });

    const lastQuantity    = stock ? stock.quantity : 0;
    const currentQuantity = lastQuantity + delta;

    if (stock) {
        await UPDATE(Stocks).set({ quantity: currentQuantity }).where({ ID: stock.ID });
    } else {
        await INSERT.into(Stocks).entries({ material_ID, warehouse_ID, quantity: currentQuantity });
    }

    const updatedStock = stock
        ? stock
        : await SELECT.one.from(Stocks).where({ material_ID, warehouse_ID });

    await INSERT.into(StockHistory).entries({
        stock_ID:        updatedStock.ID,
        moviment_ID,
        lastQuantity,
        currentQuantity,
    });
}
