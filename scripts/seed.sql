-- Seed inicial de produção — executar uma única vez após o primeiro deploy.
-- Cria usuário admin com senha temporária "admin123" (bcrypt custo 10).
-- IMPORTANTE: trocar a senha imediatamente após o primeiro login.

INSERT INTO br_dev_imlucas_logestoque_auth_Users (
    ID,
    username,
    "firstName",
    "lastName",
    "passwordHash",
    active,
    "createdAt",
    "createdBy",
    "modifiedAt",
    "modifiedBy"
) VALUES (
    gen_random_uuid(),
    'admin',
    'Administrador',
    'Sistema',
    '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', -- "admin123"
    true,
    now(),
    'seed',
    now(),
    'seed'
) ON CONFLICT (username) DO NOTHING;

-- Cria permissão ADMIN se não existir
INSERT INTO br_dev_imlucas_logestoque_auth_Permissions (
    ID,
    name,
    description,
    "createdAt",
    "createdBy",
    "modifiedAt",
    "modifiedBy"
) VALUES (
    gen_random_uuid(),
    'ADMIN',
    'Acesso total ao sistema',
    now(),
    'seed',
    now(),
    'seed'
) ON CONFLICT (name) DO NOTHING;

-- Vincula admin à permissão ADMIN
INSERT INTO br_dev_imlucas_logestoque_auth_UserPermissions (
    ID,
    user_ID,
    permission_ID,
    "createdAt",
    "createdBy",
    "modifiedAt",
    "modifiedBy"
)
SELECT
    gen_random_uuid(),
    u.ID,
    p.ID,
    now(),
    'seed',
    now(),
    'seed'
FROM br_dev_imlucas_logestoque_auth_Users u
JOIN br_dev_imlucas_logestoque_auth_Permissions p ON p.name = 'ADMIN'
WHERE u.username = 'admin'
ON CONFLICT DO NOTHING;
