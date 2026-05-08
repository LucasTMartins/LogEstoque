using {
    cuid,
    managed
} from '@sap/cds/common';

using {
    db.inventory,
    db.types
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
        // composition child to MovimentDetail on child.movimentID = $self.ID
        };

    entity MovimentDetail : cuid, managed {
        movimentID          : UUID;
        moviment            : Association to one inventory.Moviments;
        materialCode        : String(50);
        materialDescription : String;
        materialUnitMeasure : String(10);
        warehouseCode       : String(50);
        warehouseName       : String(100);
        type                : types.MovimentTypes;
        quantity            : Integer;
        status              : types.MovimentStatus;
        observation         : String;
        stockHistory        : Association to many inventory.StockHistory
                                  on stockHistory.moviment = $self.moviment;
    }
}
