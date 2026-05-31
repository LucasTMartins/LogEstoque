'use strict';

const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const axios = require('axios');
const cds = require('@sap/cds');

const BASE = '/odata/v4/main';
const testKit = cds.test('.').in(__dirname + '/../../');

let httpEstoque;
let httpViewer;
let httpAdmin;

before(async () => {
    const { url } = await testKit;

    httpAdmin = axios.create({
        baseURL: url,
        headers: { 'content-type': 'application/json' },
        validateStatus: () => true,
    });
    httpEstoque = axios.create({
        baseURL: url,
        headers: { 'content-type': 'application/json' },
        validateStatus: () => true,
    });
    httpViewer = axios.create({
        baseURL: url,
        headers: { 'content-type': 'application/json' },
        validateStatus: () => true,
    });

    const adminLogin = await httpAdmin.post('/auth/login', { username: 'admin', password: 'pass-01' });
    assert.equal(adminLogin.status, 200);
    httpAdmin.defaults.headers.common.Authorization = `Bearer ${adminLogin.data.token}`;

    const estoqueLogin = await httpEstoque.post('/auth/login', { username: 'joao.silva', password: 'pass-01' });
    assert.equal(estoqueLogin.status, 200);
    httpEstoque.defaults.headers.common.Authorization = `Bearer ${estoqueLogin.data.token}`;

    const viewerLogin = await httpViewer.post('/auth/login', { username: 'pedro.alves', password: 'pass-01' });
    assert.equal(viewerLogin.status, 200);
    httpViewer.defaults.headers.common.Authorization = `Bearer ${viewerLogin.data.token}`;
});

async function createDistributionCenter(code) {
    const res = await httpEstoque.post(`${BASE}/createDistributionCenterWithAddress`, {
        code,
        name: `CD ${code}`,
        street: `Rua ${code}`,
        number: '100',
        district: 'Centro',
        town: 'sao paulo',
        state: 'sp',
        country_code: '032',
        zipCode: '01310-100',
    });
    assert.equal(res.status, 200, JSON.stringify(res.data));
    return res.data;
}

test('CurrentUser expõe opções de gerenciamento para ESTOQUE e oculta para usuário sem permissão', async () => {
    const estoqueRes = await httpEstoque.get(`${BASE}/CurrentUser?$top=1`);
    assert.equal(estoqueRes.status, 200);
    const estoqueUser = estoqueRes.data.value[0];
    assert.equal(estoqueUser.canManageMaterials, true);
    assert.equal(estoqueUser.canManageWarehouses, true);
    assert.equal(estoqueUser.canManageDistributionCenters, true);
    assert.equal(estoqueUser.canViewStocks, true);
    assert.equal(estoqueUser.hasManagementOptions, true);

    const viewerRes = await httpViewer.get(`${BASE}/CurrentUser?$top=1`);
    assert.equal(viewerRes.status, 200);
    const viewerUser = viewerRes.data.value[0];
    assert.equal(viewerUser.canManageMaterials, false);
    assert.equal(viewerUser.canManageWarehouses, false);
    assert.equal(viewerUser.canManageDistributionCenters, false);
    assert.equal(viewerUser.canViewStocks, false);
    assert.equal(viewerUser.hasManagementOptions, false);
});

test('ManagedUsers expõe report de usuários apenas para ADMIN', async () => {
    const adminRes = await httpAdmin.get(`${BASE}/ManagedUsers?$top=1`);
    assert.equal(adminRes.status, 200);
    assert.ok(Array.isArray(adminRes.data.value));
    assert.ok(adminRes.data.value.length > 0);
    assert.ok(!('passwordHash' in adminRes.data.value[0]));

    const estoqueRes = await httpEstoque.get(`${BASE}/ManagedUsers?$top=1`);
    assert.equal(estoqueRes.status, 403);
});

test('ESTOQUE cria centro de distribuição com endereço e depósito/armazém vinculado', async () => {
    const suffix = String(Date.now()).slice(-8);
    const dc = await createDistributionCenter(`T${suffix.slice(0, 9)}`);
    const addressRes = await httpEstoque.get(`${BASE}/Addresses(${dc.address_ID})`);
    assert.equal(addressRes.status, 200, JSON.stringify(addressRes.data));
    assert.equal(addressRes.data.town, 'Sao Paulo');
    assert.equal(addressRes.data.state, 'SP');

    const whRes = await httpEstoque.post(`${BASE}/createWarehouse`, {
        code: `W${suffix}`,
        name: `Armazem ${suffix}`,
        capacity: 100,
        distributionCenterId: dc.ID,
    });
    assert.equal(whRes.status, 200, JSON.stringify(whRes.data));
    assert.equal(whRes.data.active, true);
    assert.equal(whRes.data.distributionCenter_ID, dc.ID);
});

test('usuário sem permissão não cria depósito/armazém', async () => {
    const res = await httpViewer.post(`${BASE}/createWarehouse`, {
        code: 'W-NOAUTH',
        name: 'Sem Permissao',
        capacity: 10,
        distributionCenterId: '55352009-8e4c-46c6-984d-d97627290c55',
    });
    assert.equal(res.status, 403);
});

test('bloqueia exclusão de depósito/armazém em uso', async () => {
    const res = await httpEstoque.delete(`${BASE}/Warehouses(11915179-3453-42ad-84c8-5c859edf99de)`);
    assert.equal(res.status, 409);
    assert.match(JSON.stringify(res.data), /está em uso/);
});

test('bloqueia exclusão de centro de distribuição com depósito/armazém vinculado', async () => {
    const res = await httpEstoque.delete(`${BASE}/DistributionCenters(55352009-8e4c-46c6-984d-d97627290c55)`);
    assert.equal(res.status, 409);
    assert.match(JSON.stringify(res.data), /possui depósitos/);
});

test('bloqueia exclusão de endereço vinculado a centro de distribuição', async () => {
    const suffix = String(Date.now()).slice(-8);
    const dc = await createDistributionCenter(`A${suffix.slice(0, 9)}`);

    const res = await httpEstoque.delete(`${BASE}/Addresses(${dc.address_ID})`);
    assert.equal(res.status, 409);
    assert.match(JSON.stringify(res.data), /vinculado/);
});

test('estoque é somente leitura pelo MainService', async () => {
    const listRes = await httpEstoque.get(`${BASE}/Stocks?$top=1`);
    assert.equal(listRes.status, 200);
    assert.ok(Array.isArray(listRes.data.value));

    const postRes = await httpEstoque.post(`${BASE}/Stocks`, {
        material_ID: '20157005-d245-412e-bbef-ba3d5f84d175',
        warehouse_ID: '11915179-3453-42ad-84c8-5c859edf99de',
        quantity: 1,
    });
    assert.ok(postRes.status >= 400);

    const stockId = listRes.data.value[0].ID;
    const patchRes = await httpEstoque.patch(`${BASE}/Stocks(${stockId})`, { quantity: 999 });
    assert.ok(patchRes.status >= 400);

    const deleteRes = await httpEstoque.delete(`${BASE}/Stocks(${stockId})`);
    assert.ok(deleteRes.status >= 400);
});
