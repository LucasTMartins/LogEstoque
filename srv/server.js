const cds = require('@sap/cds');
const express = require('express');
const authMiddleware = require('./auth/auth-middleware');
const loginHandler = require('./auth/login-handler');

cds.on('bootstrap', (app) => {
  // Parse JSON body
  app.use(express.json());

  // Middleware de autenticação (executado antes de todas as rotas CAP)
  app.use(authMiddleware);

  // Rota de login
  app.post('/auth/login', loginHandler);
});

module.exports = cds.server;
