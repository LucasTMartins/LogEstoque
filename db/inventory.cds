using {
    cuid,
    managed
} from '@sap/cds/common';
using {
    masterdata.Materials,
    masterdata.Warehouses
} from './master-data';


namespace inventory;

entity Stocks : cuid, managed {
    material  : Association to one Materials;
    warehouse : Association to one Warehouses;
    quantity  : Integer;
}

entity Moviments : cuid, managed {
    type                 : String(20); //mudar tipo para valores fixos: ENTRADA, SAÍDA
    material             : Association to one Materials;
    quantity             : Integer;
    originWarehouse      : Association to one Warehouses;
    destinationWarehouse : Association to one Warehouses;
    status               : String(20); //mudar tipo para valores fixos: REJEITADO, PENDENTE, APROVADO, CONCLUÍDO
    observation          : String;
}

entity StockHistory : cuid, managed {
    stock           : Association to one Stocks;
    lastQuantity    : Integer;
    currentQuantity : Integer;
    moviment        : Association to one Moviments;
}
