using {
    cuid,
    managed
} from '@sap/cds/common';

namespace db.auth;

entity Users : cuid, managed {
    username    : String(12) @assert.unique;
    firstName   : String(20);
    lastName    : String(100);
    password    : String(255);
    active      : Boolean;
    permissions : Composition of many UserPermissions
                      on permissions.user = $self;
}

entity Permissions : cuid, managed {
    name        : String(50);
    description : String;
}

entity UserPermissions : cuid, managed {
    user       : Association to one Users;
    permission : Association to one Permissions;
} annotate UserPermissions with @assert.unique: {
    unique_user_permission: [user, permission]
};
