using {
    cuid,
    managed
} from '@sap/cds/common';
using {Country} from '@sap/cds/common';
using {db.inventory} from './inventory';


namespace db.masterdata;

entity Materials : cuid, managed {
    code        : String(50)  @mandatory  @assert.format: '^[A-Z0-9_-]+$'  @title: 'Código'  @assert.unique;
    description : String      @mandatory  @title        : 'Descrição';
    unitMeasure : String(10)  @mandatory  @assert.format: '^[A-Z]{1,5}$'   @title: 'Unidade';
    active      : Boolean     @mandatory  @title        : 'Ativo';
}

entity DistributionCenters : cuid, managed {
    code       : String(10)  @mandatory  @assert.format: '^[A-Z0-9_-]+$'  @title: 'Código'  @assert.unique;
    name       : String(100);

    @mandatory  @title: 'Nome'
    address    : Association to one Addresses;
    warehouses : Composition of many Warehouses
                     on warehouses.distributionCenter = $self;
    active     : Boolean     @mandatory  @title        : 'Ativo';
}

entity Warehouses : cuid, managed {
    code               : String(50)                              @mandatory  @assert.format: '^[A-Z0-9_-]+$'  @title       : 'Código'  @assert.unique;
    name               : String(100)                             @mandatory  @title        : 'Nome';
    capacity           : Integer                                 @mandatory  @title        : 'Capacidade'     @assert.range: [
        0,
        _
    ];
    distributionCenter : Association to one DistributionCenters  @mandatory  @assert.target;
    stocks             : Composition of many inventory.Stocks
                             on stocks.warehouse = $self;
    active             : Boolean                                 @mandatory  @title        : 'Ativo';
}

entity Addresses : cuid, managed {
    street      : String(100) @mandatory;
    number      : String(10)  @mandatory;
    district    : String(50)  @mandatory;
    town        : String(50)  @mandatory;
    state       : String(50)  @mandatory;
    country     : Country     @mandatory;
    zipCode     : String(9)   @mandatory  @assert.format: '^[0-9]{5}-?[0-9]{3}$';
    observation : String(100);
    active      : Boolean     @mandatory;
}
