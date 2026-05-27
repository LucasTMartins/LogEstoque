using { db.auth } from '../db/index.cds';

service AdminService @(requires: 'ADMIN') {

    // Users sem expor passwordHash — campos listados explicitamente
    entity Users as projection on auth.Users {
        ID, username, firstName, lastName, active,
        createdAt, createdBy, modifiedAt, modifiedBy,
        permissions
    } actions {
        action toggleActive()                                   returns Users;
        action resetPassword(@mandatory newPassword : String)   returns Boolean;
        action assignPermission(@mandatory permissionId : UUID) returns UserPermissions;
        action revokePermission(@mandatory permissionId : UUID) returns Boolean;
    };

    @readonly entity Permissions as projection on auth.Permissions;

    entity UserPermissions as projection on auth.UserPermissions;

    action createUser(
        username   : String(12),
        firstName  : String(20),
        lastName   : String(100),
        password   : String,
        active     : Boolean,
        permissions: many UUID
    ) returns Users;
}
