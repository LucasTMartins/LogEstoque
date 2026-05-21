const cds = require('@sap/cds');
const { verifyToken } = require('./jwt');

// CAP custom auth provider — called for every request.
// Sets req.user when token is valid; leaves req.user unset (anonymous) otherwise.
// CAP's @requires annotations then handle 401/403 automatically.
module.exports = function authMiddleware(req, _res, next) {
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.slice(7);
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
