'use strict';

const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const axios  = require('axios');
const cds    = require('@sap/cds');

// ─── Setup ────────────────────────────────────────────────────────────────────

let http;
const BASE = '/odata/v4/main';

const testKit = cds.test('.').in(__dirname + '/../../');

before(async () => {
    const { url } = await testKit;

    http = axios.create({
        baseURL:        url,
        headers:        { 'content-type': 'application/json' },
        validateStatus: () => true,
    });

    // joao.silva tem ESTOQUE no seed
    const loginRes = await http.post('/auth/login', { username: 'joao.silva', password: 'pass-01' });
    assert.equal(loginRes.status, 200, 'Login deve retornar 200');
    http.defaults.headers.common['Authorization'] = `Bearer ${loginRes.data.token}`;
});

// Wrappers que lançam em 4xx/5xx
async function POST(path, data) {
    const res = await http.post(path, data);
    if (res.status >= 400) {
        const err = new Error(`HTTP ${res.status}`);
        err.response = res;
        throw err;
    }
    return res;
}

async function DELETE(path) {
    const res = await http.delete(path);
    if (res.status >= 400) {
        const err = new Error(`HTTP ${res.status}`);
        err.response = res;
        throw err;
    }
    return res;
}

// ─── Leitura ──────────────────────────────────────────────────────────────────

test('lista materiais retorna dados do seed', async () => {
    const res = await http.get(`${BASE}/Materials`);
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.data.value));
    assert.ok(res.data.value.length > 0);
});

// ─── Criação ──────────────────────────────────────────────────────────────────

test('cria material com active=true por padrão quando não informado', async () => {
    const res = await POST(`${BASE}/Materials`, {
        code:        'TST-001',
        description: 'Material de Teste Unitário',
        unitMeasure: 'UN',
    });
    assert.equal(res.data.active, true, 'active deve ser true por padrão');
    assert.ok(res.data.ID, 'deve retornar ID gerado');
    assert.equal(res.data.code, 'TST-001');
});

test('cria material explicitamente inativo', async () => {
    const res = await POST(`${BASE}/Materials`, {
        code:        'TST-002',
        description: 'Material Inativo de Teste',
        unitMeasure: 'KG',
        active:      false,
    });
    assert.equal(res.data.active, false);
});

test('rejeita criação sem código (campo obrigatório)', async () => {
    await assert.rejects(
        () => POST(`${BASE}/Materials`, {
            description: 'Sem Código',
            unitMeasure: 'UN',
        }),
        () => true
    );
});

test('rejeita criação sem descrição (campo obrigatório)', async () => {
    await assert.rejects(
        () => POST(`${BASE}/Materials`, {
            code:        'TST-NODESC',
            unitMeasure: 'UN',
        }),
        () => true
    );
});

test('rejeita código duplicado', async () => {
    await POST(`${BASE}/Materials`, {
        code: 'TST-DUP', description: 'Primeiro', unitMeasure: 'UN',
    });
    await assert.rejects(
        () => POST(`${BASE}/Materials`, {
            code: 'TST-DUP', description: 'Segundo', unitMeasure: 'UN',
        }),
        () => true
    );
});

// ─── Soft Delete ──────────────────────────────────────────────────────────────

test('DELETE marca material como inativo (soft delete)', async () => {
    const created = await POST(`${BASE}/Materials`, {
        code:        'TST-DEL',
        description: 'Para Deletar',
        unitMeasure: 'UN',
    });
    const id = created.data.ID;

    await DELETE(`${BASE}/Materials(${id})`);

    // Verificar diretamente no banco que o registro ainda existe mas está inativo
    const db  = await cds.connect.to('db');
    const SYS = new cds.User.Privileged();
    const mat = await db.tx({ user: SYS }, tx =>
        tx.run(SELECT.one.from('db.masterdata.Materials').where({ ID: id }))
    );
    assert.ok(mat, 'material deve ainda existir no banco');
    assert.equal(mat.active, false, 'material deve estar marcado como inativo');
});

test('DELETE em material inexistente retorna 404', async () => {
    const res = await http.delete(`${BASE}/Materials(00000000-0000-0000-0000-000000000000)`);
    assert.equal(res.status, 404);
});

// ─── Atualização ──────────────────────────────────────────────────────────────

test('PATCH atualiza descrição do material', async () => {
    const created = await POST(`${BASE}/Materials`, {
        code:        'TST-UPD',
        description: 'Descrição Original',
        unitMeasure: 'PC',
    });
    const id = created.data.ID;

    const patchRes = await http.patch(`${BASE}/Materials(${id})`, {
        description: 'Descrição Atualizada',
    });
    assert.equal(patchRes.status, 200);
    assert.equal(patchRes.data.description, 'Descrição Atualizada');
});
