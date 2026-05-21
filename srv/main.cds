using {
    db.inventory,
    db.masterdata
} from '../db/index.cds';

service MainService @(requires: 'authenticated-user') {

    // Entidade principal — CRUD completo + ações de workflow
    @cds.redirection.target: true
    entity Moviments  as projection on inventory.Moviments actions {
        action approve()                                          returns Moviments;
        action rejectMoviment(@mandatory reason : String(500))    returns Moviments;
        action conclude()                                         returns Moviments;
    };

    // Value helps (somente leitura)
    @readonly entity Materials  as projection on masterdata.Materials {
        key ID,
            code,
            description,
            unitMeasure,
            active
    };

    @readonly entity Warehouses as projection on masterdata.Warehouses {
        key ID,
            code,
            name,
            capacity,
            active
    };

    // View desnormalizada para relatórios (somente leitura)
    @readonly entity MovimentByWarehouse  as projection on inventory.Moviments {
        key ID,
            createdAt,
            createdBy,
            modifiedAt,
            modifiedBy,
            type,
            material.code             as materialCode,
            material.description      as materialDescription,
            material.unitMeasure      as materialUnitMeasure,
            quantity,
            originWarehouse.code      as originWarehouseCode,
            originWarehouse.name      as originWarehouseName,
            destinationWarehouse.code as destinationWarehouseCode,
            destinationWarehouse.name as destinationWarehouseName,
            status,
            observation,
            details                   : Composition of many MovimentDetail
                                            on details.moviment.ID = ID
    };

    entity MovimentDetail         as projection on inventory.StockHistory {
        key ID,
            createdAt,
            createdBy,
            modifiedAt,
            modifiedBy,
            moviment,
            stock.material.code        as materialCode,
            stock.material.description as materialDescription,
            stock.material.unitMeasure as materialUnitMeasure,
            stock.warehouse.code       as warehouseCode,
            stock.warehouse.name       as warehouseName,
            lastQuantity,
            currentQuantity,
            moviment.type              as type,
            moviment.quantity          as movimentQuantity,
            moviment.status            as status,
            moviment.observation       as observation
    };
}
