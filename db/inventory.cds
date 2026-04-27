using {
    cuid,
    managed
} from '@sap/cds/common';
using {db.masterdata} from './master-data';
using {db.types} from './types';

namespace db.inventory;

entity Stocks : cuid, managed {
    material  : Association to one masterdata.Materials;
    warehouse : Association to one masterdata.Warehouses;
    quantity  : Integer;
}

annotate Stocks with @assert.unique: {unique_material_warehouse: [
    material,
    warehouse
]};

entity Moviments : cuid, managed {
    type                 : types.MovimentTypes;
    material             : Association to one masterdata.Materials;
    quantity             : Integer;
    originWarehouse      : Association to one masterdata.Warehouses;
    destinationWarehouse : Association to one masterdata.Warehouses;
    status               : types.MovimentStatus;
    observation          : String;
}

entity StockHistory : cuid, managed {
    stock           : Association to one Stocks;
    lastQuantity    : Integer;
    currentQuantity : Integer;
    moviment        : Association to one Moviments;
}
