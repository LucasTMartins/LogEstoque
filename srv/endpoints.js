const cds = require('@sap/cds');
const bcryptjs = require('bcryptjs');

module.exports = class EndpointsService extends cds.ApplicationService {
    async init() {
        // passwordHash está na projeção para permitir escrita via POST/PATCH,
        // mas é removido das respostas de leitura pelo after READ handler.
        this.after(['READ', 'CREATE', 'UPDATE'], 'Users', (users) => {
            const items = Array.isArray(users) ? users : users ? [users] : [];
            for (const user of items) delete user.passwordHash;
        });

        return super.init();
    }
};
