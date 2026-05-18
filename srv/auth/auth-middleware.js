const cds = require('@sap/cds');
const { verifyToken } = require('./jwt');

function authMiddleware(req, res, next) {
  // Rotas públicas — não exigem autenticação
  const publicPaths = ['/auth/login', '/health'];
  if (publicPaths.some(p => req.path.startsWith(p))) {
    return next();
  }

  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token não fornecido' });
  }

  const token = authHeader.slice(7);

  try {
    const payload = verifyToken(token);

    // Popula cds.context.user com id e roles
    req.user = payload;
    if (cds.context) {
      cds.context.user = new cds.User({
        id: payload.username,
        roles: payload.roles || [],
        attr: { fullName: payload.fullName },
      });
    }

    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token inválido ou expirado' });
  }
}

module.exports = authMiddleware;
