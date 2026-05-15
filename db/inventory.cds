using {
    cuid,
    managed
} from '@sap/cds/common';
using {db.masterdata} from './master-data';
using {db.types} from './types';

namespace db.inventory;

entity Stocks : cuid, managed {
    material  : Association to one masterdata.Materials   @mandatory  @assert.target;
    warehouse : Association to one masterdata.Warehouses  @mandatory  @assert.target;
    quantity  : Integer                                   @mandatory  @assert.range: [
        0,
        _
    ];
}

annotate Stocks with @assert.unique: {unique_material_warehouse: [
    material,
    warehouse
]};

entity Moviments : cuid, managed {
    type                 : types.MovimentTypes                      @mandatory;
    material             : Association to one masterdata.Materials  @mandatory  @assert.target;
    quantity             : Integer                                  @mandatory  @assert.range: [
        1,
        _
    ];
    originWarehouse      : Association to one masterdata.Warehouses @assert.target;
    destinationWarehouse : Association to one masterdata.Warehouses @assert.target;
    status               : types.MovimentStatus                     @mandatory;
    observation          : String(500);
}

entity StockHistory : cuid, managed {
    stock           : Association to one Stocks     @mandatory  @assert.target;
    lastQuantity    : Integer                       @mandatory  @assert.range: [
        0,
        _
    ];
    currentQuantity : Integer                       @mandatory  @assert.range: [
        0,
        _
    ];
    moviment        : Association to one Moviments  @mandatory  @assert.target;
}
