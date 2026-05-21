'use strict';

const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const axios  = require('axios');
const cds    = require('@sap/cds');

// ─── Setup ────────────────────────────────────────────────────────────────────

let http;
let material_ID, warehouse_ID;
const BASE = '/odata/v4/main';

const testKit = cds.test('.').in(__dirname + '/../../');

before(async () => {
    const { url } = await testKit; // aguarda server iniciar; url vem do valor resolvido

    http = axios.create({
        baseURL:       url,
        headers:       { 'content-type': 'application/json' },
        validateStatus: () => true, // nunca lançar em 4xx/5xx — tratamos manualmente
    });

    // Login para obter token e configurar o header padrão
    const loginRes = await http.post('/auth/login', { username: 'joao.silva', password: 'pass-01' });
    assert.equal(loginRes.status, 200, 'Login deve retornar 200');
    http.defaults.headers.common['Authorization'] = `Bearer ${loginRes.data.token}`;

    // Buscar IDs de seed data
    const matRes = await http.get(`${BASE}/Materials?$top=1`);
    const whRes  = await http.get(`${BASE}/Warehouses?$top=1`);
    material_ID  = matRes.data.value[0].ID;
    warehouse_ID = whRes.data.value[0].ID;
});

// Wrappers que lançam em 4xx/5xx (comportamento esperado pelos testes de erro)
async function GET(path) {
    const res = await http.get(path);
    if (res.status >= 400) {
        const err = new Error(`HTTP ${res.status}`);
        err.response = res;
        throw err;
    }
    return res;
}

async function POST(path, data) {
    const res = await http.post(path, data);
    if (res.status >= 400) {
        const err = new Error(`HTTP ${res.status}`);
        err.response = res;
        throw err;
    }
    return res;
}

// Helper: criar movimentação de Entrada
async function criarEntrada(qty = 10) {
    const res = await POST(`${BASE}/Moviments`, {
        type:                    'E',
        material_ID,
        quantity:                qty,
        destinationWarehouse_ID: warehouse_ID,
    });
    return res.data;
}

// ─── Autenticação ─────────────────────────────────────────────────────────────

test('login com credenciais corretas retorna token JWT', async () => {
    const res = await http.post('/auth/login', { username: 'joao.silva', password: 'pass-01' });
    assert.equal(res.status, 200);
    assert.ok(res.data.token, 'deve retornar token');
    assert.ok(Array.isArray(res.data.roles), 'roles deve ser array');
});

// ─── Criação ──────────────────────────────────────────────────────────────────

test('cria movimentação de Entrada com status Pendente', async () => {
    const mov = await criarEntrada(10);
    assert.ok(mov.ID, 'deve ter ID');
    assert.equal(mov.status, 'P');
    assert.equal(mov.type, 'E');
    assert.equal(mov.quantity, 10);
});

test('rejeita criação sem material', async () => {
    await assert.rejects(
        () => POST(`${BASE}/Moviments`, {
            type: 'E', quantity: 5, destinationWarehouse_ID: warehouse_ID,
        }),
        () => true
    );
});

test('rejeita criação de Saída sem armazém origem', async () => {
    await assert.rejects(
        () => POST(`${BASE}/Moviments`, {
            type: 'S', material_ID, quantity: 5, destinationWarehouse_ID: warehouse_ID,
        }),
        () => true
    );
});

// ─── Fluxo completo: Entrada → Aprovar → Concluir ────────────────────────────

test('fluxo Entrada: criar → aprovar → concluir atualiza estoque', async () => {
    const mov = await criarEntrada(25);
    assert.equal(mov.status, 'P');

    // Ler estoque antes de concluir
    const db  = await cds.connect.to('db');
    const SYS = new cds.User.Privileged();
    const stockBefore = await db.tx({ user: SYS }, tx =>
        tx.run(SELECT.one.from('db.inventory.Stocks').where({ material_ID, warehouse_ID }))
    );
    const qtdBefore = stockBefore ? stockBefore.quantity : 0;

    // Aprovar
    const approveRes = await POST(`${BASE}/Moviments(${mov.ID})/MainService.approve`, {});
    assert.equal(approveRes.data.status, 'A');

    // Concluir
    const concludeRes = await POST(`${BASE}/Moviments(${mov.ID})/MainService.conclude`, {});
    assert.equal(concludeRes.data.status, 'C');

    // Verificar estoque atualizado
    const stockAfter = await db.tx({ user: SYS }, tx =>
        tx.run(SELECT.one.from('db.inventory.Stocks').where({ material_ID, warehouse_ID }))
    );
    assert.ok(stockAfter, 'registro de estoque deve existir');
    assert.equal(stockAfter.quantity, qtdBefore + 25);

    // Verificar histórico criado
    const history = await db.tx({ user: SYS }, tx =>
        tx.run(SELECT.from('db.inventory.StockHistory').where({ moviment_ID: mov.ID }))
    );
    assert.equal(history.length, 1);
    assert.equal(history[0].currentQuantity, qtdBefore + 25);
});

// ─── Rejeitar ─────────────────────────────────────────────────────────────────

test('rejeitar movimentação pendente muda status para R', async () => {
    const mov = await criarEntrada(5);
    const res = await POST(`${BASE}/Moviments(${mov.ID})/MainService.rejectMoviment`, {
        reason: 'Material incorreto no pedido',
    });
    assert.equal(res.data.status, 'R');
    assert.ok(res.data.observation);
});

test('rejeitar sem motivo deve retornar 4xx', async () => {
    const mov = await criarEntrada(3);
    await assert.rejects(
        () => POST(`${BASE}/Moviments(${mov.ID})/MainService.rejectMoviment`, { reason: '' }),
        (err) => {
            assert.ok(err.response?.status >= 400, `esperado 4xx, recebido ${err.response?.status}`);
            return true;
        }
    );
});

// ─── Transições inválidas ──────────────────────────────────────────────────────

test('não pode aprovar movimentação já aprovada', async () => {
    const mov = await criarEntrada(1);
    await POST(`${BASE}/Moviments(${mov.ID})/MainService.approve`, {});
    await assert.rejects(
        () => POST(`${BASE}/Moviments(${mov.ID})/MainService.approve`, {}),
        (err) => { assert.ok(err.response?.status >= 400); return true; }
    );
});

test('não pode concluir movimentação pendente sem aprovar antes', async () => {
    const mov = await criarEntrada(1);
    await assert.rejects(
        () => POST(`${BASE}/Moviments(${mov.ID})/MainService.conclude`, {}),
        (err) => { assert.ok(err.response?.status >= 400); return true; }
    );
});
