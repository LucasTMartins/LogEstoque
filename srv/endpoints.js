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

        this.on('redefinirSenha', async (req) => {
            const { userID, novaSenha } = req.data;
            const { Users } = cds.entities('db.auth');
            const hash = await bcryptjs.hash(novaSenha, 10);
            await UPDATE(Users).set({ passwordHash: hash }).where({ ID: userID });
            return true;
        });

        return super.init();
    }
};
