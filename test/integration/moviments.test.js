'use strict';

const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const axios  = require('axios');
const cds    = require('@sap/cds');

// ─── Setup ────────────────────────────────────────────────────────────────────

let http;
let httpAprov;
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

    // Login joao.silva (ESTOQUE) — usado para criar/concluir
    const loginRes = await http.post('/auth/login', { username: 'joao.silva', password: 'pass-01' });
    assert.equal(loginRes.status, 200, 'Login deve retornar 200');
    http.defaults.headers.common['Authorization'] = `Bearer ${loginRes.data.token}`;

    // Login maria.aprovacao (APROVACAO) — usado para aprovar/rejeitar
    const aprovRes = await http.post('/auth/login', { username: 'maria.aprovacao', password: 'pass-01' });
    assert.equal(aprovRes.status, 200, 'Login de aprovação deve retornar 200');
    httpAprov = axios.create({
        baseURL:        url,
        headers:        { 'content-type': 'application/json', Authorization: `Bearer ${aprovRes.data.token}` },
        validateStatus: () => true,
    });

    // Buscar IDs de seed data (apenas ativos para respeitar as novas validações)
    const matRes = await http.get(`${BASE}/Materials?$filter=active eq true&$orderby=code asc&$top=1`);
    const whRes  = await http.get(`${BASE}/Warehouses?$filter=active eq true&$top=1`);
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

async function POSTasAprov(path, data) {
    const res = await httpAprov.post(path, data);
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

    // Aprovar (requer role APROVACAO)
    const approveRes = await POSTasAprov(`${BASE}/Moviments(${mov.ID})/MainService.approve`, {});
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
    const res = await POSTasAprov(`${BASE}/Moviments(${mov.ID})/MainService.rejectMoviment`, {
        reason: 'Material incorreto no pedido',
    });
    assert.equal(res.data.status, 'R');
    assert.ok(res.data.observation);
});

test('rejeitar sem motivo deve retornar 4xx', async () => {
    const mov = await criarEntrada(3);
    await assert.rejects(
        () => POSTasAprov(`${BASE}/Moviments(${mov.ID})/MainService.rejectMoviment`, { reason: '' }),
        (err) => {
            assert.ok(err.response?.status >= 400, `esperado 4xx, recebido ${err.response?.status}`);
            return true;
        }
    );
});

// ─── Transições inválidas ──────────────────────────────────────────────────────

test('não pode aprovar movimentação já aprovada', async () => {
    const mov = await criarEntrada(1);
    await POSTasAprov(`${BASE}/Moviments(${mov.ID})/MainService.approve`, {});
    await assert.rejects(
        () => POSTasAprov(`${BASE}/Moviments(${mov.ID})/MainService.approve`, {}),
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

// ─── Validações na criação (Feature 2) ────────────────────────────────────────

// Seed conhecidos:
// MAT-001 (ativo) tem estoque de 15 unidades em W001 (ativo)
// W002 é inativo
// W003 é ativo mas não tem estoque de MAT-001

const MAT_001 = '20157005-d245-412e-bbef-ba3d5f84d175';
const W001    = '11915179-3453-42ad-84c8-5c859edf99de';
const W002    = '11915180-6360-4d6a-85ea-c77d43ef4ecf';
const W003    = '5ee836ef-74ab-4639-84eb-57ebd81b894f';
const MAT_002 = '16064985-ec0b-4f0c-99a8-17b3bc0e0e1e'; // inativo

test('rejeita Saída quando não há estoque do material no armazém de origem', async () => {
    await assert.rejects(
        () => POST(`${BASE}/Moviments`, {
            type:                    'S',
            material_ID:             MAT_001,
            quantity:                1,
            originWarehouse_ID:      W003,      // W003 ativo mas sem estoque de MAT-001
            destinationWarehouse_ID: W001,
        }),
        (err) => {
            assert.ok(err.response?.status === 409, `esperado 409, recebido ${err.response?.status}`);
            return true;
        }
    );
});

test('rejeita Saída quando quantidade excede estoque disponível', async () => {
    await assert.rejects(
        () => POST(`${BASE}/Moviments`, {
            type:                    'S',
            material_ID:             MAT_001,
            quantity:                9999,      // MAT-001 em W001 tem apenas 15
            originWarehouse_ID:      W001,
            destinationWarehouse_ID: W003,
        }),
        (err) => {
            assert.ok(err.response?.status === 409, `esperado 409, recebido ${err.response?.status}`);
            return true;
        }
    );
});

test('rejeita movimentação com armazém de origem inativo', async () => {
    await assert.rejects(
        () => POST(`${BASE}/Moviments`, {
            type:                    'S',
            material_ID:             MAT_001,
            quantity:                1,
            originWarehouse_ID:      W002,      // W002 inativo
            destinationWarehouse_ID: W003,
        }),
        (err) => {
            assert.ok(err.response?.status === 422, `esperado 422, recebido ${err.response?.status}`);
            return true;
        }
    );
});

test('rejeita movimentação com material inativo', async () => {
    await assert.rejects(
        () => POST(`${BASE}/Moviments`, {
            type:                    'E',
            material_ID:             MAT_002,   // MAT-002 inativo
            quantity:                1,
            destinationWarehouse_ID: W001,
        }),
        (err) => {
            assert.ok(err.response?.status === 422, `esperado 422, recebido ${err.response?.status}`);
            return true;
        }
    );
});

test('cria Saída com estoque suficiente (quantidade exata)', async () => {
    const res = await POST(`${BASE}/Moviments`, {
        type:                    'S',
        material_ID:             MAT_001,
        quantity:                15,            // exatamente o disponível
        originWarehouse_ID:      W001,
        destinationWarehouse_ID: W003,
    });
    assert.equal(res.data.status, 'P');
    assert.equal(res.data.type, 'S');
});

test('cria Saída sem armazém destino (saída para cliente externo)', async () => {
    const res = await POST(`${BASE}/Moviments`, {
        type:               'S',
        material_ID:        MAT_001,
        quantity:           5,
        originWarehouse_ID: W001,
    });
    assert.equal(res.data.status, 'P');
    assert.equal(res.data.type, 'S');
    assert.ok(!res.data.destinationWarehouse_ID, 'destino deve ser nulo para saída externa');
});
