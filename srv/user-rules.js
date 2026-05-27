'use strict';

const USERNAME_REGEX = /^[a-zA-Z0-9._-]{3,12}$/;

function validatePassword(password) {
    if (!password || password.length < 8)
        return 'A senha deve ter no mínimo 8 caracteres';
    return null;
}

function validateUsername(username) {
    if (!username || !USERNAME_REGEX.test(username))
        return 'Username deve ter entre 3 e 12 caracteres (letras, números, ., _ ou -)';
    return null;
}

// Returns true if targetUserId is the only active admin in the system
function isLastAdmin(activeAdminIds, targetUserId) {
    return activeAdminIds.length <= 1 && activeAdminIds.includes(targetUserId);
}

module.exports = { validatePassword, validateUsername, isLastAdmin };
