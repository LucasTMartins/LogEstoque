const jwt = require("jsonwebtoken");

const SECRET = process.env.JWT_SECRET;
if (!SECRET || SECRET.length < 32) {
    if (process.env.NODE_ENV === 'production') {
        throw new Error('JWT_SECRET obrigatório em produção e deve ter no mínimo 32 caracteres');
    }
    // eslint-disable-next-line no-console
    console.warn('[WARN] JWT_SECRET não definido ou muito curto — usando fallback inseguro. NÃO use em produção.');
}
const EFFECTIVE_SECRET = (SECRET && SECRET.length >= 32) ? SECRET : 'dev-secret-inseguro-nao-usar-em-producao';
const EXPIRES_IN = process.env.JWT_EXPIRES_IN || "8h";

function signToken(payload) {
  return jwt.sign(payload, EFFECTIVE_SECRET, { expiresIn: EXPIRES_IN });
}

function verifyToken(token) {
  return jwt.verify(token, EFFECTIVE_SECRET);
}

module.exports = { signToken, verifyToken };
