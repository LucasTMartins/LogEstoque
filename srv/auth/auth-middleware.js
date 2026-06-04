const cds = require('@sap/cds');
const { verifyToken } = require('./jwt');

// CAP custom auth provider — called for every request.
// Sets req.user when token is valid; leaves req.user unset (anonymous) otherwise.
// CAP's @requires annotations then handle 401/403 automatically.
module.exports = function authMiddleware(req, _res, next) {
    const tokens = _extractTokens(req);
    for (const token of tokens) {
        try {
            const payload = verifyToken(token);
            req.user = new cds.User({
                id: payload.username,
                roles: payload.roles || [],
                attr: { fullName: payload.fullName },
            });
            break;
        } catch (_err) {
            // Try the next available token source before falling back to anonymous.
        }
    }
    next();
};

function _extractTokens(req) {
    const tokens = [];
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) tokens.push(authHeader.slice(7));

    const cookieHeader = req.headers['cookie'];
    if (cookieHeader) {
        const match = cookieHeader.match(/(?:^|;\s*)auth_token=([^;]+)/);
        if (match) tokens.push(decodeURIComponent(match[1]));
    }
    return tokens;
}
