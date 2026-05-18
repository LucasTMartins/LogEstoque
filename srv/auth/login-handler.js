const cds = require('@sap/cds');
const { compare } = require('bcryptjs');
const { signToken } = require('./jwt');
const { SELECT } = cds.ql;

async function loginHandler(req, res) {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'username e password são obrigatórios' });
  }

  // Busca o usuário com suas permissões
  const db = await cds.connect.to('db');
  const { Users } = db.entities('db.auth');

  const user = await db.run(
    SELECT.one.from(Users)
      .columns('ID', 'username', 'passwordHash', 'firstName', 'lastName', 'active')
      .where({ username })
  );

  if (!user || !user.active) {
    return res.status(401).json({ error: 'Credenciais inválidas' });
  }

  const passwordMatch = await compare(password, user.passwordHash);
  if (!passwordMatch) {
    return res.status(401).json({ error: 'Credenciais inválidas' });
  }

  // Busca permissões do usuário
  const { UserPermissions, Permissions } = db.entities('db.auth');
  const userPerms = await db.run(
    SELECT.from(UserPermissions)
      .columns('permission.name')
      .where({ user_ID: user.ID })
  );

  const roles = userPerms.map(p => p.permission_code || p['permission.code']);

  const token = signToken({
    sub: user.ID,
    username: user.username,
    fullName: `${user.firstName} ${user.lastName}`,
    roles,
  });

  return res.status(200).json({ token, username: user.username, roles });
}

module.exports = loginHandler;
