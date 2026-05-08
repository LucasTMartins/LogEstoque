using {
    db.auth,
    db.inventory,
    db.masterdata
} from '../db/index.cds';

service EndpointsService {
    entity Users               as projection on auth.Users;
    entity Permissions         as projection on auth.Permissions;
    entity Moviments           as projection on inventory.Moviments;
    entity StockHistory        as projection on inventory.StockHistory;
    entity Materials           as projection on masterdata.Materials;
    entity DistributionCenters as projection on masterdata.DistributionCenters;
    entity Addresses           as projection on masterdata.Addresses;
}
