using {
    cuid,
    managed
} from '@sap/cds/common';
using {
    masterdata.Materials,
    masterdata.Warehouses
} from './master-data';
using { types } from './types';

namespace inventory;

entity Stocks : cuid, managed {
    material  : Association to one Materials;
    warehouse : Association to one Warehouses;
    quantity  : Integer;
} annotate Stocks with @assert.unique: {
    unique_material_warehouse: [material, warehouse]
};

entity Moviments : cuid, managed {
    type                 : types.MovimentTypes;
    material             : Association to one Materials;
    quantity             : Integer;
    originWarehouse      : Association to one Warehouses;
    destinationWarehouse : Association to one Warehouses;
    status               : types.MovimentStatus;
    observation          : String;
}

entity StockHistory : cuid, managed {
    stock           : Association to one Stocks;
    lastQuantity    : Integer;
    currentQuantity : Integer;
    moviment        : Association to one Moviments;
}
