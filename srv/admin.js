'use strict';

const cds    = require('@sap/cds');
const bcrypt = require('bcryptjs');
const rules  = require('./user-rules');

module.exports = class AdminService extends cds.ApplicationService {

    async init() {
        const { Users, Permissions, UserPermissions } = cds.entities('db.auth');

        // Bloqueia alteração direta de username e passwordHash via PATCH
        this.before('UPDATE', 'Users', (req) => {
            if ('username' in req.data)
                return req.error(400, 'O username não pode ser alterado após a criação.');
            if ('passwordHash' in req.data)
                return req.error(400, 'Use a ação resetPassword para alterar a senha.');
        });

        this.on('createUser', async (req) => {
            const { username, firstName, lastName, password, active, permissions: permIds = [] } = req.data;

            const usernameErr = rules.validateUsername(username);
            if (usernameErr) return req.error(400, usernameErr);

            const passErr = rules.validatePassword(password);
            if (passErr) return req.error(400, passErr);

            if (!firstName?.trim()) return req.error(400, 'Nome é obrigatório.');
            if (!lastName?.trim())  return req.error(400, 'Sobrenome é obrigatório.');

            const passwordHash = await bcrypt.hash(password, 10);
            await INSERT.into(Users).entries({ username, firstName, lastName, passwordHash, active: active ?? true });

            const created = await SELECT.one.from(Users).where({ username });

            if (permIds.length > 0) {
                await INSERT.into(UserPermissions).entries(
                    permIds.map(pid => ({ user_ID: created.ID, permission_ID: pid }))
                );
            }

            return SELECT.one.from(Users).where({ ID: created.ID });
        });

        this.on('toggleActive', 'Users', async (req) => {
            const { ID } = req.params[0];
            const user   = await SELECT.one.from(Users).where({ ID });
            if (!user) return req.error(404, 'Usuário não encontrado.');

            // Admin não pode desativar a própria conta
            if (user.username === req.user.id)
                return req.error(409, 'Você não pode desativar sua própria conta.');

            // Não pode desativar o último admin ativo
            if (user.active) {
                const admins = await _activeAdminIds(Users, UserPermissions, Permissions);
                if (rules.isLastAdmin(admins, ID))
                    return req.error(409, 'Não é possível desativar o último administrador ativo.');
            }

            await UPDATE(Users).set({ active: !user.active }).where({ ID });
            return SELECT.one.from(Users).where({ ID });
        });

        this.on('resetPassword', 'Users', async (req) => {
            const { ID } = req.params[0];
            const { newPassword } = req.data;

            const user = await SELECT.one.from(Users).where({ ID });
            if (!user) return req.error(404, 'Usuário não encontrado.');

            if (user.username === req.user.id)
                return req.error(409, 'Use o endpoint de perfil para alterar sua própria senha.');

            const err = rules.validatePassword(newPassword);
            if (err) return req.error(400, err);

            await UPDATE(Users).set({ passwordHash: await bcrypt.hash(newPassword, 10) }).where({ ID });
            return true;
        });

        this.on('assignPermission', 'Users', async (req) => {
            const { ID } = req.params[0];
            const { permissionId } = req.data;

            if (!await SELECT.one.from(Users).where({ ID }))
                return req.error(404, 'Usuário não encontrado.');
            if (!await SELECT.one.from(Permissions).where({ ID: permissionId }))
                return req.error(404, 'Permissão não encontrada.');

            const existing = await SELECT.one.from(UserPermissions).where({ user_ID: ID, permission_ID: permissionId });
            if (existing) return existing;

            await INSERT.into(UserPermissions).entries({ user_ID: ID, permission_ID: permissionId });
            return SELECT.one.from(UserPermissions).where({ user_ID: ID, permission_ID: permissionId });
        });

        this.on('revokePermission', 'Users', async (req) => {
            const { ID } = req.params[0];
            const { permissionId } = req.data;

            const user = await SELECT.one.from(Users).where({ ID });
            if (!user) return req.error(404, 'Usuário não encontrado.');

            const perm = await SELECT.one.from(Permissions).where({ ID: permissionId });
            if (!perm) return req.error(404, 'Permissão não encontrada.');

            if (perm.name === 'ADMIN') {
                // Admin não pode revogar a própria permissão ADMIN
                if (user.username === req.user.id)
                    return req.error(409, 'Você não pode revogar sua própria permissão de ADMIN.');

                // Não pode remover o único admin ativo
                const admins = await _activeAdminIds(Users, UserPermissions, Permissions);
                if (rules.isLastAdmin(admins, ID))
                    return req.error(409, 'Não é possível remover a permissão ADMIN do último administrador ativo.');
            }

            await DELETE.from(UserPermissions).where({ user_ID: ID, permission_ID: permissionId });
            return true;
        });

        await super.init();
    }
};

async function _activeAdminIds(Users, UserPermissions, Permissions) {
    const adminPerm = await SELECT.one.from(Permissions).where({ name: 'ADMIN' });
    if (!adminPerm) return [];

    const ups = await SELECT.from(UserPermissions).where({ permission_ID: adminPerm.ID });
    const ids = ups.map(u => u.user_ID);
    if (!ids.length) return [];

    const actives = await SELECT.from(Users).where({ ID: { in: ids }, active: true });
    return actives.map(u => u.ID);
}
