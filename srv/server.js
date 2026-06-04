const cds = require('@sap/cds');
const express = require('express');
const path = require('path');
const loginHandler   = require('./auth/login-handler');
const authMiddleware = require('./auth/auth-middleware');
const runSeed        = require('../scripts/seed-dev');
const bootstrapAdmin = require('./bootstrap-admin');

const WEBAPP_DIR      = path.resolve(__dirname, '../app/logestoque/webapp');
const LOGIN_PAGE      = path.join(WEBAPP_DIR, 'login/index.html');
const ADMIN_SEED_PAGE = path.join(__dirname, 'admin-seed.html');

function isHttpsRequest(req) {
    return req.secure || String(req.headers['x-forwarded-proto'] || '').split(',')[0] === 'https';
}

function requireAuth(req, res, next) {
    if (!req.user) return res.status(401).json({ error: 'Não autenticado' });
    next();
}

function requireAdmin(req, res, next) {
    if (!req.user) return res.status(401).json({ error: 'Não autenticado' });
    if (!req.user.is('ADMIN'))
        return res.status(403).json({ error: 'Acesso negado: role ADMIN requerida' });
    next();
}

cds.on('bootstrap', (app) => {
    app.set('trust proxy', 1);
    app.use(express.json());
    // Serve o frontend pré-compilado no path que o manifest.json declara como ID do app.
    // cds-plugin-ui5 faz isso automaticamente em dev; em produção precisamos registrar manualmente.
    app.use('/br.dev.imlucas.logestoque', express.static(WEBAPP_DIR));
    app.post('/auth/login', loginHandler);
    app.post('/auth/logout', (req, res) => {
        res.clearCookie('auth_token', {
            httpOnly: true,
            sameSite: 'Lax',
            secure:   isHttpsRequest(req),
            path:     '/',
        });
        res.status(204).end();
    });
    // authMiddleware deve rodar explicitamente pois estas rotas são registradas
    // antes do middleware global de auth do CDS
    app.get('/auth/me', authMiddleware, requireAuth, (req, res) => {
        const roles = Object.keys(req.user.roles || {});
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
    app.get('/login',      (_req, res) => res.sendFile(LOGIN_PAGE));
    app.get('/',           (_req, res) => res.redirect('/br.dev.imlucas.logestoque/index.html'));
    app.get('/admin/seed', (_req, res) => res.sendFile(ADMIN_SEED_PAGE));
    app.post('/admin/seed', authMiddleware, requireAdmin, async (_req, res) => {
        try {
            await runSeed();
            res.json({ message: 'Seed executado com sucesso!' });
        } catch (err) {
            res.status(500).json({ message: `Erro: ${err.message}` });
        }
    });
});

cds.on('served', async () => {
    try {
        await bootstrapAdmin();
    } catch (err) {
        console.error('[bootstrap] Erro ao criar admin inicial:', err.message);
    }
});

module.exports = cds.server;
