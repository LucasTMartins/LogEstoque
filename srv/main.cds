using {
    db.inventory
} from '../db/index.cds';

service MainService {
    entity MovimentByWarehouse as
        projection on inventory.Moviments {
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
                details : Composition of many MovimentDetail
                              on details.moviment = $self
        };

    entity MovimentDetail      as
        projection on inventory.StockHistory {
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
