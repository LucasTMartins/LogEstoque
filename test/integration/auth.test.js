'use strict';

const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const axios  = require('axios');
const cds    = require('@sap/cds');

let http;

const testKit = cds.test('.').in(__dirname + '/../../');

before(async () => {
    const { url } = await testKit;
    http = axios.create({
        baseURL:        url,
        headers:        { 'content-type': 'application/json' },
        validateStatus: () => true,
        withCredentials: true,
    });
});

// ─── Login ────────────────────────────────────────────────────────────────────

test('POST /auth/login com credenciais válidas retorna 200 e token', async () => {
    const res = await http.post('/auth/login', { username: 'joao.silva', password: 'pass-01' });
    assert.equal(res.status, 200);
    assert.ok(res.data.token, 'deve retornar token');
    assert.ok(Array.isArray(res.data.roles), 'roles deve ser array');
});

test('POST /auth/login emite cookie auth_token utilizável pelo /auth/me', async () => {
    const loginRes = await http.post('/auth/login', { username: 'joao.silva', password: 'pass-01' });
    const authCookie = loginRes.headers['set-cookie']?.find((cookie) => cookie.startsWith('auth_token='));

    assert.ok(authCookie, 'deve retornar cookie auth_token');
    assert.match(authCookie, /;\s*HttpOnly/i);
    assert.match(authCookie, /;\s*SameSite=Lax/i);

    const meRes = await http.get('/auth/me', {
        headers: { Cookie: authCookie.split(';')[0] },
    });

    assert.equal(meRes.status, 200);
    assert.equal(meRes.data.user.username, 'joao.silva');
});

test('POST /auth/login via HTTPS/proxy emite cookie Secure', async () => {
    const res = await http.post('/auth/login', { username: 'joao.silva', password: 'pass-01' }, {
        headers: { 'X-Forwarded-Proto': 'https' },
    });
    const authCookie = res.headers['set-cookie']?.find((cookie) => cookie.startsWith('auth_token='));

    assert.ok(authCookie, 'deve retornar cookie auth_token');
    assert.match(authCookie, /;\s*Secure/i);
});

test('POST /auth/login com senha errada retorna 401', async () => {
    const res = await http.post('/auth/login', { username: 'joao.silva', password: 'senha-errada' });
    assert.equal(res.status, 401);
});

test('POST /auth/login com usuário inexistente retorna 401', async () => {
    const res = await http.post('/auth/login', { username: 'nao.existe', password: 'qualquer' });
    assert.equal(res.status, 401);
});

test('POST /auth/login com usuário inativo retorna 401 (não 403)', async () => {
    const res = await http.post('/auth/login', { username: 'maria.santos', password: 'pass-01' });
    assert.equal(res.status, 401);
});

// ─── /auth/me ─────────────────────────────────────────────────────────────────

test('GET /auth/me com token válido retorna dados do usuário', async () => {
    const loginRes = await http.post('/auth/login', { username: 'joao.silva', password: 'pass-01' });
    const res = await http.get('/auth/me', {
        headers: { Authorization: `Bearer ${loginRes.data.token}` },
    });
    assert.equal(res.status, 200);
    assert.ok(res.data.user, 'deve retornar objeto user');
    assert.equal(res.data.user.username, 'joao.silva');
});

test('GET /auth/me sem token retorna 401', async () => {
    const res = await http.get('/auth/me');
    assert.equal(res.status, 401);
});

test('GET /auth/me com token inválido retorna 401', async () => {
    const res = await http.get('/auth/me', {
        headers: { Authorization: 'Bearer token.invalido.aqui' },
    });
    assert.equal(res.status, 401);
});

// ─── /admin/seed ──────────────────────────────────────────────────────────────

test('GET /admin/seed usa validação por cookie e não exige token em sessionStorage', async () => {
    const res = await http.get('/admin/seed');

    assert.equal(res.status, 200);
    assert.match(res.data, /fetch\('\/auth\/me'/);
    assert.doesNotMatch(res.data, /sessionStorage\.getItem\('token'\)/);
});

test('POST /admin/seed com cookie de usuário não-admin autentica e retorna 403', async () => {
    const loginRes = await http.post('/auth/login', { username: 'joao.silva', password: 'pass-01' });
    const authCookie = loginRes.headers['set-cookie']?.find((cookie) => cookie.startsWith('auth_token='));

    assert.ok(authCookie, 'deve retornar cookie auth_token');

    const res = await http.post('/admin/seed', {}, {
        headers: { Cookie: authCookie.split(';')[0] },
    });

    assert.equal(res.status, 403);
});

// ─── /auth/logout ─────────────────────────────────────────────────────────────

test('POST /auth/logout retorna 204', async () => {
    const res = await http.post('/auth/logout');
    assert.equal(res.status, 204);
});

// ─── /health ─────────────────────────────────────────────────────────────────

test('GET /health retorna 200 com status ok', async () => {
    const res = await http.get('/health');
    assert.equal(res.status, 200);
    assert.equal(res.data.status, 'ok');
    assert.ok(res.data.timestamp, 'deve retornar timestamp');
});
