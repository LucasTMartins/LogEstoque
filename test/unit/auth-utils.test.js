'use strict';

// Definir JWT_SECRET antes de importar o módulo (que lança erro se ausente)
process.env.JWT_SECRET = 'test-secret-para-auth-utils-tests-32chars!!';

const { test } = require('node:test');
const assert   = require('node:assert/strict');
const jwt      = require('../../srv/auth/jwt');

test('signToken retorna string JWT válida', () => {
    const token = jwt.signToken({ username: 'test', roles: ['ESTOQUE'] });
    assert.ok(typeof token === 'string');
    assert.ok(token.split('.').length === 3, 'JWT deve ter 3 partes separadas por ponto');
});

test('verifyToken decodifica payload corretamente', () => {
    const payload = { username: 'joao.silva', roles: ['ESTOQUE'], isAdmin: false };
    const token   = jwt.signToken(payload);
    const decoded = jwt.verifyToken(token);
    assert.equal(decoded.username, payload.username);
    assert.deepEqual(decoded.roles, payload.roles);
    assert.equal(decoded.isAdmin, false);
});

test('verifyToken lança erro para token inválido', () => {
    assert.throws(
        () => jwt.verifyToken('token.invalido.aqui'),
        (err) => {
            assert.ok(err instanceof Error);
            return true;
        }
    );
});

test('verifyToken lança erro para token com assinatura adulterada', () => {
    const token    = jwt.signToken({ username: 'admin' });
    const parts    = token.split('.');
    const tampered = parts[0] + '.' + parts[1] + '.assinatura-falsa';
    assert.throws(() => jwt.verifyToken(tampered));
});

test('signToken inclui campo iat (issued at)', () => {
    const token   = jwt.signToken({ username: 'test' });
    const decoded = jwt.verifyToken(token);
    assert.ok(typeof decoded.iat === 'number', 'iat deve ser um número');
});

test('signToken inclui campo exp (expiration)', () => {
    const token   = jwt.signToken({ username: 'test' });
    const decoded = jwt.verifyToken(token);
    assert.ok(typeof decoded.exp === 'number', 'exp deve ser um número');
    assert.ok(decoded.exp > decoded.iat, 'exp deve ser posterior a iat');
});
