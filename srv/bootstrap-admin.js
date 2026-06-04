'use strict';

const cds = require('@sap/cds');

const ADMIN_USER_ID       = '14138606-c2a8-4e73-9a12-1e64c31c7882';
const ADMIN_PERMISSION_ID = '30669913-2a9e-479e-9939-b4f90660b3bb';
const ADMIN_UP_ID         = '84424820-4a46-415e-ace8-c04fdc24b7a5';

// bcrypt hash of "pass-01" (cost 10) — same hash used in test fixtures
const ADMIN_PASSWORD_HASH = '$2b$10$Enzxnv/IY6mZejCabgW/H.ZS2hCYfuiETH7vC6k9O3tXa0m7c.4Ie';

async function bootstrapAdmin() {
    const { Users, Permissions, UserPermissions } = cds.entities('db.auth');

    // Only seed if no ADMIN permission is assigned to any user
    const adminPerm = await SELECT.one.from(Permissions).where({ name: 'ADMIN' });
    if (adminPerm) {
        const existingLink = await SELECT.one.from(UserPermissions).where({ permission_ID: adminPerm.ID });
        if (existingLink) return;
    }

    console.log('[bootstrap] Nenhum admin encontrado — criando usuário admin inicial...');

    const NOW = new Date().toISOString();

    if (!adminPerm) {
        await INSERT.into(Permissions).entries({
            ID:          ADMIN_PERMISSION_ID,
            name:        'ADMIN',
            description: 'Acesso total ao sistema',
            createdAt:   NOW,
            createdBy:   'bootstrap',
            modifiedAt:  NOW,
            modifiedBy:  'bootstrap',
        });
    }

    const permID = adminPerm ? adminPerm.ID : ADMIN_PERMISSION_ID;

    const existingAdmin = await SELECT.one.from(Users).where({ username: 'admin' });
    if (!existingAdmin) {
        await INSERT.into(Users).entries({
            ID:           ADMIN_USER_ID,
            username:     'admin',
            firstName:    'Admin',
            lastName:     'Sistema',
            passwordHash: ADMIN_PASSWORD_HASH,
            active:       true,
            createdAt:    NOW,
            createdBy:    'bootstrap',
            modifiedAt:   NOW,
            modifiedBy:   'bootstrap',
        });
    }

    const userID = existingAdmin ? existingAdmin.ID : ADMIN_USER_ID;

    await INSERT.into(UserPermissions).entries({
        ID:            ADMIN_UP_ID,
        user_ID:       userID,
        permission_ID: permID,
        createdAt:     NOW,
        createdBy:     'bootstrap',
        modifiedAt:    NOW,
        modifiedBy:    'bootstrap',
    });

    console.log('[bootstrap] Usuário admin criado. Login: admin / Senha: pass-01');
}

module.exports = bootstrapAdmin;
