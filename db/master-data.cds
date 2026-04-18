using {
    cuid,
    managed
} from '@sap/cds/common';
using {Country} from '@sap/cds/common';
using {inventory.Stocks} from './inventory';


namespace masterdata;

entity Materials : cuid, managed {
    code        : String(50) @assert.unique;
    description : String;
    unitMeasure : String(10);
    active      : Boolean;
}

entity DistributionCenters : cuid, managed {
    code       : String(10) @assert.unique;
    name       : String(100);
    address    : Association to one Addresses;
    warehouses : Composition of many Warehouses
                     on warehouses.distributionCenter = $self;
    active     : Boolean;
}

entity Warehouses : cuid, managed {
    code               : String(50) @assert.unique;
    name               : String(100);
    capacity           : Integer;
    distributionCenter : Association to one DistributionCenters;
    stock              : Composition of many Stocks
                             on stock.warehouse = $self;
    active             : Boolean;
}

entity Addresses : cuid, managed {
    street      : String(100);
    number      : String(10);
    district    : String(50);
    town        : String(50);
    country     : Country;
    zipCode     : String(9);
    observation : String(100);
    active      : Boolean;
}
