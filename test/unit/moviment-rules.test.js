'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const {
    STATUS,
    TYPE,
    validateNewMoviment,
    validateStatusTransition,
    checkStockAvailability,
    checkWarehouseCapacity,
} = require('../../srv/moviment-rules');

// ─── validateNewMoviment ──────────────────────────────────────────────────────

describe('validateNewMoviment', () => {

    test('Entrada válida com destino e material', () => {
        const errors = validateNewMoviment({
            type:                    TYPE.E,
            material_ID:             'mat-1',
            quantity:                10,
            destinationWarehouse_ID: 'wh-dest',
        });
        assert.deepEqual(errors, []);
    });

    test('Saída válida com origem e destino', () => {
        const errors = validateNewMoviment({
            type:                    TYPE.S,
            material_ID:             'mat-1',
            quantity:                5,
            originWarehouse_ID:      'wh-orig',
            destinationWarehouse_ID: 'wh-dest',
        });
        assert.deepEqual(errors, []);
    });

    test('Erro: tipo ausente', () => {
        const errors = validateNewMoviment({
            material_ID:             'mat-1',
            quantity:                1,
            destinationWarehouse_ID: 'wh-dest',
        });
        assert.ok(errors.length > 0);
        assert.ok(errors.some(e => /tipo/i.test(e)));
    });

    test('Erro: tipo inválido', () => {
        const errors = validateNewMoviment({
            type:                    'X',
            material_ID:             'mat-1',
            quantity:                1,
            destinationWarehouse_ID: 'wh-dest',
        });
        assert.ok(errors.some(e => /tipo inválido/i.test(e)));
    });

    test('Erro: material ausente', () => {
        const errors = validateNewMoviment({
            type:                    TYPE.E,
            quantity:                5,
            destinationWarehouse_ID: 'wh-dest',
        });
        assert.ok(errors.some(e => /material/i.test(e)));
    });

    test('Erro: quantidade zero', () => {
        const errors = validateNewMoviment({
            type:                    TYPE.E,
            material_ID:             'mat-1',
            quantity:                0,
            destinationWarehouse_ID: 'wh-dest',
        });
        assert.ok(errors.some(e => /quantidade/i.test(e)));
    });

    test('Erro: quantidade negativa', () => {
        const errors = validateNewMoviment({
            type:                    TYPE.E,
            material_ID:             'mat-1',
            quantity:                -3,
            destinationWarehouse_ID: 'wh-dest',
        });
        assert.ok(errors.some(e => /quantidade/i.test(e)));
    });

    test('Erro: saída sem armazém origem', () => {
        const errors = validateNewMoviment({
            type:                    TYPE.S,
            material_ID:             'mat-1',
            quantity:                5,
            destinationWarehouse_ID: 'wh-dest',
        });
        assert.ok(errors.some(e => /origem/i.test(e)));
    });

    test('Erro: origem e destino iguais', () => {
        const errors = validateNewMoviment({
            type:                    TYPE.S,
            material_ID:             'mat-1',
            quantity:                5,
            originWarehouse_ID:      'wh-1',
            destinationWarehouse_ID: 'wh-1',
        });
        assert.ok(errors.some(e => /mesmo|iguais/i.test(e)));
    });

    test('Múltiplos erros retornados juntos', () => {
        const errors = validateNewMoviment({});
        assert.ok(errors.length >= 3);
    });

});

// ─── validateStatusTransition ─────────────────────────────────────────────────

describe('validateStatusTransition', () => {

    test('P → A permitido (aprovar)', () => {
        assert.equal(validateStatusTransition(STATUS.P, STATUS.A), true);
    });

    test('P → R permitido (rejeitar pendente)', () => {
        assert.equal(validateStatusTransition(STATUS.P, STATUS.R), true);
    });

    test('A → C permitido (concluir)', () => {
        assert.equal(validateStatusTransition(STATUS.A, STATUS.C), true);
    });

    test('A → R permitido (rejeitar aprovado)', () => {
        assert.equal(validateStatusTransition(STATUS.A, STATUS.R), true);
    });

    test('C → qualquer coisa: proibido', () => {
        assert.equal(validateStatusTransition(STATUS.C, STATUS.P), false);
        assert.equal(validateStatusTransition(STATUS.C, STATUS.A), false);
        assert.equal(validateStatusTransition(STATUS.C, STATUS.R), false);
    });

    test('R → qualquer coisa: proibido', () => {
        assert.equal(validateStatusTransition(STATUS.R, STATUS.P), false);
        assert.equal(validateStatusTransition(STATUS.R, STATUS.A), false);
        assert.equal(validateStatusTransition(STATUS.R, STATUS.C), false);
    });

    test('P → C: proibido (pular aprovação)', () => {
        assert.equal(validateStatusTransition(STATUS.P, STATUS.C), false);
    });

    test('A → P: proibido (voltar para pendente)', () => {
        assert.equal(validateStatusTransition(STATUS.A, STATUS.P), false);
    });

});

// ─── checkStockAvailability ───────────────────────────────────────────────────

describe('checkStockAvailability', () => {

    const stocks = [
        { warehouse_ID: 'wh-1', material_ID: 'mat-a', quantity: 50 },
        { warehouse_ID: 'wh-1', material_ID: 'mat-b', quantity: 10 },
        { warehouse_ID: 'wh-2', material_ID: 'mat-a', quantity: 5 },
    ];

    test('suficiente: quantidade exata', () => {
        assert.equal(checkStockAvailability('wh-1', 'mat-a', 50, stocks), true);
    });

    test('suficiente: quantidade menor', () => {
        assert.equal(checkStockAvailability('wh-1', 'mat-a', 30, stocks), true);
    });

    test('insuficiente: quantidade maior que estoque', () => {
        assert.equal(checkStockAvailability('wh-1', 'mat-a', 51, stocks), false);
    });

    test('insuficiente: sem registro no armazém', () => {
        assert.equal(checkStockAvailability('wh-3', 'mat-a', 1, stocks), false);
    });

    test('insuficiente: material inexistente naquele armazém', () => {
        assert.equal(checkStockAvailability('wh-2', 'mat-b', 1, stocks), false);
    });

    test('insuficiente: estoque zero', () => {
        const stocks0 = [{ warehouse_ID: 'wh-x', material_ID: 'mat-x', quantity: 0 }];
        assert.equal(checkStockAvailability('wh-x', 'mat-x', 1, stocks0), false);
    });

});

// ─── checkWarehouseCapacity ───────────────────────────────────────────────────

describe('checkWarehouseCapacity', () => {

    const warehouses = [
        { ID: 'wh-1', capacity: 100 },
        { ID: 'wh-2', capacity: 50 },
    ];

    const stocks = [
        { warehouse_ID: 'wh-1', material_ID: 'mat-a', quantity: 60 },
        { warehouse_ID: 'wh-1', material_ID: 'mat-b', quantity: 20 },
    ];

    test('cabe: dentro da capacidade', () => {
        // wh-1: 60+20 = 80; adicionar 15 → 95 ≤ 100
        assert.equal(checkWarehouseCapacity('wh-1', 15, stocks, warehouses), true);
    });

    test('cabe exatamente na capacidade', () => {
        // 80 + 20 = 100 == 100
        assert.equal(checkWarehouseCapacity('wh-1', 20, stocks, warehouses), true);
    });

    test('não cabe: excederia capacidade', () => {
        // 80 + 21 = 101 > 100
        assert.equal(checkWarehouseCapacity('wh-1', 21, stocks, warehouses), false);
    });

    test('armazém sem estoque prévio aceita até a capacidade', () => {
        // wh-2 tem estoque vazio no array
        assert.equal(checkWarehouseCapacity('wh-2', 50, stocks, warehouses), true);
    });

    test('armazém sem estoque prévio rejeita acima da capacidade', () => {
        assert.equal(checkWarehouseCapacity('wh-2', 51, stocks, warehouses), false);
    });

    test('armazém inexistente: retorna false', () => {
        assert.equal(checkWarehouseCapacity('wh-99', 1, stocks, warehouses), false);
    });

});
