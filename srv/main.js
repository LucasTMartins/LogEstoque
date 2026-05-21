'use strict';

const cds  = require('@sap/cds');
const rules = require('./moviment-rules');

module.exports = class MainService extends cds.ApplicationService {

    async init() {

        const { Moviments, Stocks, StockHistory } = cds.entities('db.inventory');
        const { Warehouses }                      = cds.entities('db.masterdata');

        // ── Criação de movimentação ─────────────────────────────────────────

        this.before('CREATE', 'Moviments', (req) => {
            const data   = req.data;
            const errors = rules.validateNewMoviment(data);
            if (errors.length > 0) return req.error(400, errors.join('; '));

            // Status inicial sempre Pendente — usuário não pode definir
            req.data.status = rules.STATUS.P;
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

        await super.init();
    }

};

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
