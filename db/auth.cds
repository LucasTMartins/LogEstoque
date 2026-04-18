using {
    cuid,
    managed
} from '@sap/cds/common';

namespace auth;

entity Users : cuid, managed {
    username    : String(12);
    firstName   : String(20);
    lastName    : String(100);
    password    : String(255);
    active      : Boolean;
    permissions : Association to many Permissions;
}

entity Permissions : cuid, managed {
    name        : String(50);
    description : String;
}
