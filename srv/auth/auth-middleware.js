const cds = require('@sap/cds');
const { verifyToken } = require('./jwt');

// CAP custom auth provider — called for every request.
// Sets req.user when token is valid; leaves req.user unset (anonymous) otherwise.
// CAP's @requires annotations then handle 401/403 automatically.
module.exports = function authMiddleware(req, _res, next) {
    const token = _extractToken(req);
    if (token) {
        try {
            const payload = verifyToken(token);
            req.user = new cds.User({
                id: payload.username,
                roles: payload.roles || [],
                attr: { fullName: payload.fullName },
            });
        } catch (_err) {
            // Invalid/expired token — CAP will reject via @requires
        }
    }
    next();
};

function _extractToken(req) {
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) return authHeader.slice(7);

    const cookieHeader = req.headers['cookie'];
    if (cookieHeader) {
        const match = cookieHeader.match(/(?:^|;\s*)auth_token=([^;]+)/);
        if (match) return decodeURIComponent(match[1]);
    }
    return null;
}
