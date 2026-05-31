const cds = require('@sap/cds');
const express = require('express');
const path = require('path');
const loginHandler   = require('./auth/login-handler');
const authMiddleware = require('./auth/auth-middleware');

const LOGIN_PAGE = path.resolve(__dirname, '../app/logestoque/webapp/login/index.html');

function requireAuth(req, res, next) {
    if (!req.user) return res.status(401).json({ error: 'Não autenticado' });
    next();
}

cds.on('bootstrap', (app) => {
    app.use(express.json());
    app.post('/auth/login', loginHandler);
    app.post('/auth/logout', (_req, res) => {
        res.clearCookie('auth_token', {
            httpOnly: true,
            sameSite: 'Lax',
            path:     '/',
        });
        res.status(204).end();
    });
    // authMiddleware deve rodar explicitamente pois estas rotas são registradas
    // antes do middleware global de auth do CDS
    app.get('/auth/me', authMiddleware, requireAuth, (req, res) => {
        const roles = req.user.roles ? Array.from(req.user.roles) : [];
        res.json({
            user: {
                username: req.user.id,
                roles,
            },
        });
    });
    app.get('/health', async (_req, res) => {
        try {
            await cds.db.run('SELECT 1');
            res.json({ status: 'ok', timestamp: new Date().toISOString() });
        } catch {
            res.status(503).json({ status: 'error', timestamp: new Date().toISOString() });
        }
    });
    app.get('/login', (_req, res) => res.sendFile(LOGIN_PAGE));
});

module.exports = cds.server;
