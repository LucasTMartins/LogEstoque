'use strict';

const STATUS = Object.freeze({ P: 'P', A: 'A', C: 'C', R: 'R' });
const TYPE   = Object.freeze({ E: 'E', S: 'S' });

// Transições de status permitidas
const VALID_TRANSITIONS = {
    [STATUS.P]: [STATUS.A, STATUS.R],
    [STATUS.A]: [STATUS.C, STATUS.R],
    [STATUS.C]: [],
    [STATUS.R]: [],
};

/**
 * Valida os dados de uma nova movimentação antes da criação.
 * @returns {string[]} Lista de mensagens de erro (vazio = válido)
 */
function validateNewMoviment(moviment) {
    const errors = [];

    if (!moviment.type) {
        errors.push('Tipo de movimentação é obrigatório (E = Entrada, S = Saída)');
    } else if (moviment.type !== TYPE.E && moviment.type !== TYPE.S) {
        errors.push(`Tipo inválido: '${moviment.type}'. Use E ou S`);
    }

    if (!moviment.material_ID) errors.push('Material é obrigatório');
    if (!moviment.quantity || moviment.quantity < 1) errors.push('Quantidade deve ser maior que zero');
    if (!moviment.destinationWarehouse_ID) errors.push('Armazém destino é obrigatório');

    if (moviment.type === TYPE.S && !moviment.originWarehouse_ID) {
        errors.push('Armazém origem é obrigatório para movimentações de Saída');
    }

    if (
        moviment.originWarehouse_ID &&
        moviment.destinationWarehouse_ID &&
        moviment.originWarehouse_ID === moviment.destinationWarehouse_ID
    ) {
        errors.push('Armazém origem e destino não podem ser o mesmo');
    }

    return errors;
}

/**
 * Verifica se a transição de status é permitida.
 */
function validateStatusTransition(currentStatus, newStatus) {
    const allowed = VALID_TRANSITIONS[currentStatus] ?? [];
    return allowed.includes(newStatus);
}

/**
 * Verifica se há estoque suficiente para uma movimentação de Saída.
 * @param {string} warehouseID - ID do armazém origem
 * @param {string} materialID  - ID do material
 * @param {number} quantity    - Quantidade solicitada
 * @param {object[]} stocks    - Registros de estoque (cada um com warehouse_ID, material_ID, quantity)
 */
function checkStockAvailability(warehouseID, materialID, quantity, stocks) {
    const stock = stocks.find(
        s => s.warehouse_ID === warehouseID && s.material_ID === materialID
    );
    if (!stock) return false;
    return stock.quantity >= quantity;
}

/**
 * Verifica se o armazém destino suporta a quantidade sem exceder a capacidade.
 * @param {string}   warehouseID  - ID do armazém destino
 * @param {number}   quantity     - Quantidade a adicionar
 * @param {object[]} stocks       - Todos os registros de estoque (com warehouse_ID, quantity)
 * @param {object[]} warehouses   - Registros de armazém (com ID, capacity)
 */
function checkWarehouseCapacity(warehouseID, quantity, stocks, warehouses) {
    const warehouse = warehouses.find(w => w.ID === warehouseID);
    if (!warehouse) return false;

    const currentTotal = stocks
        .filter(s => s.warehouse_ID === warehouseID)
        .reduce((sum, s) => sum + (s.quantity ?? 0), 0);

    return currentTotal + quantity <= warehouse.capacity;
}

module.exports = {
    STATUS,
    TYPE,
    validateNewMoviment,
    validateStatusTransition,
    checkStockAvailability,
    checkWarehouseCapacity,
};
