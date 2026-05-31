'use strict';

const cds  = require('@sap/cds');
const bcrypt = require('bcryptjs');
const rules = require('./moviment-rules');
const userRules = require('./user-rules');

module.exports = class MainService extends cds.ApplicationService {

    async init() {

        const { Moviments, Stocks, StockHistory } = cds.entities('db.inventory');
        const { Warehouses, Materials }           = cds.entities('db.masterdata');
        const { Users, UserPermissions }          = cds.entities('db.auth');

        // ── Cadastro de materiais ───────────────────────────────────────────

        const canManageMaterials = (req) => {
            return req.user?.is('ESTOQUE') || req.user?.is('ADMIN');
        };

        const canManageMoviments = (req) => {
            return req.user?.is('ESTOQUE') || req.user?.is('LOGISTICA') || req.user?.is('ADMIN');
        };

        this.before('CREATE', 'Materials', (req) => {
            if (req.data.active === undefined || req.data.active === null)
                req.data.active = true;
        });

        this.on('DELETE', 'Materials', async (req) => {
            if (!canManageMaterials(req)) {
                return req.error(403, 'Você não tem permissão para excluir materiais. Solicite a exclusão à área.');
            }

            const { ID } = req.params[0];
            const material = await SELECT.one.from(Materials).where({ ID });
            if (!material) return req.error(404, 'Material não encontrado');

            const stockExists    = await SELECT.one.from(Stocks).where({ material_ID: ID });
            const movimentExists = await SELECT.one.from(Moviments).where({ material_ID: ID });
            if (stockExists || movimentExists) {
                return req.error(409, 'Este material está em uso (possui estoques ou movimentações) e não pode ser excluído.');
            }

            await DELETE.from(Materials).where({ ID });
            return req.reply();
        });

        this.on('toggleActive', 'Materials', async (req) => {
            if (!canManageMaterials(req)) {
                return req.error(403, 'Você não tem permissão para ativar/desativar materiais.');
            }
            const { ID } = req.params[0];
            const material = await SELECT.one.from(Materials).where({ ID });
            if (!material) return req.error(404, 'Material não encontrado.');
            await UPDATE(Materials).set({ active: !material.active }).where({ ID });
            return SELECT.one.from(Materials).where({ ID });
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

        this.on('READ', 'CurrentUser', async (req) => {
            const user = await SELECT.one.from(Users)
                .columns('username', 'firstName', 'lastName')
                .where({ username: req.user.id, active: true });

            if (!user) return req.error(404, 'Usuário não encontrado.');

            return [{
                dummy:              '1',
                username:           user.username,
                fullName:           `${user.firstName} ${user.lastName}`,
                canManageMaterials: canManageMaterials(req),
                canManageMoviments: canManageMoviments(req),
                isAdmin:            req.user?.is('ADMIN')
            }];
        });

        this.on('READ', 'CurrentUserPermissions', async (req) => {
            const user = await SELECT.one.from(Users)
                .columns('ID')
                .where({ username: req.user.id, active: true });

            if (!user) return req.error(404, 'Usuário não encontrado.');

            const permissions = await SELECT.from(UserPermissions)
                .columns('permission.name as name', 'permission.description as description')
                .where({ user_ID: user.ID });

            return permissions
                .filter(p => p.name)
                .sort((a, b) => a.name.localeCompare(b.name));
        });

        this.on('changeOwnPassword', async (req) => {
            const { currentPassword, newPassword } = req.data;
            const err = userRules.validatePassword(newPassword);
            if (err) return req.error(400, err);

            const user = await SELECT.one.from(Users)
                .columns('ID', 'passwordHash')
                .where({ username: req.user.id, active: true });

            if (!user) return req.error(404, 'Usuário não encontrado.');

            const currentPasswordMatches = await bcrypt.compare(currentPassword, user.passwordHash);
            if (!currentPasswordMatches) {
                return req.error(401, 'Senha atual inválida.');
            }

            await UPDATE(Users)
                .set({ passwordHash: await bcrypt.hash(newPassword, 10) })
                .where({ ID: user.ID });

            return true;
        });

        // ── Criação e deleção de movimentação ─────────────────────────────

        this.on('DELETE', 'Moviments', async (req) => {
            if (!req.user?.is('ESTOQUE') && !req.user?.is('ADMIN')) {
                return req.error(403, 'Você não tem permissão para excluir movimentações.');
            }
            const { ID } = req.params[0];
            const moviment = await SELECT.one.from(Moviments).where({ ID });
            if (!moviment) return req.error(404, 'Movimentação não encontrada.');
            if (moviment.status !== 'P') {
                return req.error(409, 'Somente movimentações pendentes podem ser excluídas.');
            }
            await DELETE.from(Moviments).where({ ID });
            return req.reply();
        });

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

            // Armazém destino deve estar ativo (opcional para Saída externa)
            if (data.destinationWarehouse_ID) {
                const destWh  = await SELECT.one.from(Warehouses).where({ ID: data.destinationWarehouse_ID });
                const destErr = rules.validateWarehouseActive(destWh, 'destino');
                if (destErr) return req.error(422, destErr);
            }

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

        // ── Histórico de estoque por depósito de origem/destino ────────────

        this.on('READ', 'OriginStockHistory', (req) =>
            _getWarehouseHistory(Moviments, Stocks, Warehouses, Materials, StockHistory, req, 'originWarehouse_ID')
        );

        this.on('READ', 'DestinationStockHistory', (req) =>
            _getWarehouseHistory(Moviments, Stocks, Warehouses, Materials, StockHistory, req, 'destinationWarehouse_ID')
        );

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

// ── Funções auxiliares: histórico de estoque por depósito ─────────────────────

async function _getWarehouseHistory(Moviments, Stocks, Warehouses, Materials, StockHistory, req, warehouseField) {
    const moviment_ID = _extractMovimentId(req);
    if (!moviment_ID) return [];

    const moviment = await SELECT.one
        .from(Moviments)
        .columns('material_ID', 'originWarehouse_ID', 'destinationWarehouse_ID')
        .where({ ID: moviment_ID });
    if (!moviment) return [];

    const warehouse_ID = moviment[warehouseField];
    if (!warehouse_ID) return [];

    const stocks = await SELECT.from(Stocks).columns('ID').where({ material_ID: moviment.material_ID, warehouse_ID });
    if (!stocks.length) return [];

    const stock_IDs = stocks.map(s => s.ID);

    const q = SELECT.from(StockHistory)
        .where({ stock_ID: { in: stock_IDs } })
        .orderBy('createdAt desc');

    // Aplica filtro de data vindo da barra de filtros do Fiori Elements
    const userWhere = req.query?.SELECT?.where;
    if (userWhere?.length) {
        const dateWhere = _expandDateFilters(userWhere);
        if (Array.isArray(q.SELECT.where)) {
            q.SELECT.where = [...q.SELECT.where, 'and', ...dateWhere];
        }
    }

    const history = await q;
    if (!history.length) return [];

    const [warehouse, material] = await Promise.all([
        SELECT.one.from(Warehouses).where({ ID: warehouse_ID }),
        SELECT.one.from(Materials).where({ ID: moviment.material_ID })
    ]);

    return history.map(h => ({
        moviment_ID,
        ID:                  h.ID,
        lastQuantity:        h.lastQuantity,
        currentQuantity:     h.currentQuantity,
        createdAt:           h.createdAt,
        createdDate:         _formatDateBR(h.createdAt),
        createdTime:         _formatTimeBR(h.createdAt),
        warehouseCode:       warehouse?.code        ?? '',
        warehouseName:       warehouse?.name        ?? '',
        materialCode:        material?.code         ?? '',
        materialDescription: material?.description  ?? '',
        unitMeasure:         material?.unitMeasure  ?? ''
    }));
}

function _formatDateBR(isoStr) {
    if (!isoStr) return '';
    const [y, m, d] = isoStr.slice(0, 10).split('-');
    return `${d}/${m}/${y}`;
}

function _formatTimeBR(isoStr) {
    if (!isoStr) return '';
    return isoStr.slice(11, 16); // HH:MM (UTC — mesmo fuso usado no restante do sistema)
}

function _extractMovimentId(req) {
    const sel = req.query?.SELECT;
    if (!sel) return undefined;

    // Caso 1: query direta com WHERE moviment_ID = ? (ex: $filter via OData)
    if (sel.where) {
        const val = _extractFilterValue(sel.where, 'moviment_ID');
        if (val) return val;
    }

    // Caso 2: navegação de composição /Moviments(ID='x')/originHistory
    // O CAP representa a chave pai em SELECT.from.ref[0].where como ID = 'x'
    const fromRef = sel.from?.ref;
    if (Array.isArray(fromRef)) {
        for (const seg of fromRef) {
            if (seg?.where) {
                const val = _extractFilterValue(seg.where, 'ID');
                if (val) return val;
            }
        }
    }

    return undefined;
}

function _extractFilterValue(where, field) {
    if (!Array.isArray(where)) return undefined;
    for (let i = 0; i < where.length; i++) {
        const token = where[i];
        if (Array.isArray(token)) {
            const val = _extractFilterValue(token, field);
            if (val !== undefined) return val;
        } else if (token?.xpr) {
            const val = _extractFilterValue(token.xpr, field);
            if (val !== undefined) return val;
        } else if (token?.ref?.[0] === field && i + 2 < where.length && where[i + 1] === '=') {
            return where[i + 2]?.val;
        }
    }
    return undefined;
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
