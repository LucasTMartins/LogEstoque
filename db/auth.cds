using {
    cuid,
    managed
} from '@sap/cds/common';

namespace db.auth;

entity Users : cuid, managed {
    username    : String(12)  @mandatory  @assert.format: '^[a-zA-Z0-9._-]{3,12}$'  @assert.unique;
    firstName   : String(20)  @mandatory;
    lastName    : String(100) @mandatory;
    password    : String(255) @mandatory;
    active      : Boolean     @mandatory;
    permissions : Composition of many UserPermissions
                      on permissions.user = $self;
}

entity Permissions : cuid, managed {
    name        : String(50)  @mandatory  @assert.unique  @assert.format: '^[A-Z_]+$';
    description : String      @mandatory;
}

entity UserPermissions : cuid, managed {
    user       : Association to one Users        @mandatory  @assert.target;
    permission : Association to one Permissions  @mandatory  @assert.target;
}

annotate UserPermissions with @assert.unique: {unique_user_permission: [
    user,
    permission
]};
