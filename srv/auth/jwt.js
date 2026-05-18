const jwt = require("jsonwebtoken");

const SECRET = process.env.JWT_SECRET || "dev-secret-inseguro";
const EXPIRES_IN = process.env.JWT_EXPIRES_IN || "8h";

function signToken(payload) {
  return jwt.sign(payload, SECRET, { expiresIn: EXPIRES_IN });
}

function verifyToken(token) {
  return jwt.verify(token, SECRET); // lança erro se inválido/expirado
}

module.exports = { signToken, verifyToken };
