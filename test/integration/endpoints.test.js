'use strict';

const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const axios  = require('axios');
const cds    = require('@sap/cds');

let httpAdmin;
let httpEstoque;

const BASE = '/odata/v4/endpoints';

const testKit = cds.test('.').in(__dirname + '/../../');

before(async () => {
    const { url } = await testKit;

    const baseHttp = axios.create({
        baseURL:        url,
        headers:        { 'content-type': 'application/json' },
        validateStatus: () => true,
    });

    // Login admin (ADMIN)
    const adminRes = await baseHttp.post('/auth/login', { username: 'admin', password: 'pass-01' });
    assert.equal(adminRes.status, 200, 'Login admin deve retornar 200');
    httpAdmin = axios.create({
        baseURL:        url,
        headers:        { 'content-type': 'application/json', Authorization: `Bearer ${adminRes.data.token}` },
        validateStatus: () => true,
    });

    // Login joao.silva (ESTOQUE) — para testar acesso negado
    const estoqueRes = await baseHttp.post('/auth/login', { username: 'joao.silva', password: 'pass-01' });
    httpEstoque = axios.create({
        baseURL:        url,
        headers:        { 'content-type': 'application/json', Authorization: `Bearer ${estoqueRes.data.token}` },
        validateStatus: () => true,
    });
});

// ─── Controle de acesso ───────────────────────────────────────────────────────

test('GET /endpoints/Users sem role ADMIN retorna 403', async () => {
    const res = await httpEstoque.get(`${BASE}/Users`);
    assert.equal(res.status, 403);
});

test('GET /endpoints/Users sem autenticação retorna 401 ou 403', async () => {
    const http = axios.create({ baseURL: (await testKit).url, validateStatus: () => true });
    const res = await http.get(`${BASE}/Users`);
    assert.ok(res.status === 401 || res.status === 403, `esperado 401 ou 403, recebido ${res.status}`);
});

// ─── Usuários ─────────────────────────────────────────────────────────────────

test('GET /endpoints/Users como ADMIN retorna lista sem campo passwordHash', async () => {
    const res = await httpAdmin.get(`${BASE}/Users`);
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.data.value), 'deve retornar array');
    assert.ok(res.data.value.length > 0, 'deve ter ao menos um usuário');

    for (const user of res.data.value) {
        assert.ok(!('passwordHash' in user), `campo passwordHash não deve aparecer na resposta (user: ${user.username})`);
    }
});

test('GET /endpoints/Users retorna campos esperados', async () => {
    const res = await httpAdmin.get(`${BASE}/Users?$top=1`);
    assert.equal(res.status, 200);
    const user = res.data.value[0];
    assert.ok('ID' in user);
    assert.ok('username' in user);
    assert.ok('active' in user);
    assert.ok(!('passwordHash' in user), 'passwordHash não deve aparecer');
});

// ─── Criação de usuário com hash de senha ─────────────────────────────────────

test('POST /endpoints/Users cria usuário e não expõe passwordHash na resposta', async () => {
    // Envia passwordHash pré-computado (hash bcrypt custo 10 da senha "pass-01")
    const novoUsuario = {
        username:     'test.user',
        firstName:    'Teste',
        lastName:     'Endpoint',
        passwordHash: '$2b$10$Enzxnv/IY6mZejCabgW/H.ZS2hCYfuiETH7vC6k9O3tXa0m7c.4Ie',
        active:       true,
    };

    const res = await httpAdmin.post(`${BASE}/Users`, novoUsuario);
    assert.equal(res.status, 201, `esperado 201, recebido ${res.status}`);
    assert.ok(!('passwordHash' in res.data), 'passwordHash não deve aparecer na resposta');
    assert.ok(!('password' in res.data), 'password em texto plano não deve aparecer');
    assert.equal(res.data.username, novoUsuario.username);
});
