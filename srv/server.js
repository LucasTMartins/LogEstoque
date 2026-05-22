const cds = require('@sap/cds');
const express = require('express');
const path = require('path');
const loginHandler = require('./auth/login-handler');

const LOGIN_PAGE = path.resolve(__dirname, '../app/logestoque/webapp/login/index.html');

cds.on('bootstrap', (app) => {
    app.use(express.json());
    app.post('/auth/login', loginHandler);
    app.get('/login', (_req, res) => res.sendFile(LOGIN_PAGE));
});

module.exports = cds.server;
