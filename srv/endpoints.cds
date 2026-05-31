using {
    db.auth,
    db.inventory,
    db.masterdata
} from '../db/index.cds';

service EndpointsService @(requires: 'ADMIN') {
    entity Users               as projection on auth.Users {
        ID, username, firstName, lastName, active,
        createdAt, createdBy, modifiedAt, modifiedBy,
        passwordHash,  // removido das respostas GET pelo after READ handler em endpoints.js
        permissions
    };
    entity Permissions         as projection on auth.Permissions;
    entity Moviments           as projection on inventory.Moviments;
    entity StockHistory        as projection on inventory.StockHistory;
    entity Stocks              as projection on inventory.Stocks;
    entity Materials           as projection on masterdata.Materials;
    entity Warehouses          as projection on masterdata.Warehouses;
    entity DistributionCenters as projection on masterdata.DistributionCenters;
    entity Addresses           as projection on masterdata.Addresses;
}
