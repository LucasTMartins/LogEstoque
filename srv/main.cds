using {
    db.inventory,
    db.masterdata,
    db.auth
} from '../db/index.cds';

service MainService @(requires: 'authenticated-user') {

    // Entidade principal — CRUD completo + ações de workflow
    @(restrict: [
        { grant: ['READ', 'UPDATE'],                                to: 'authenticated-user'               },
        { grant: ['CREATE'],                                        to: ['ESTOQUE', 'LOGISTICA', 'ADMIN']  },
        { grant: ['DELETE'],                                        to: ['ESTOQUE', 'ADMIN']               },
        { grant: ['approve', 'rejectMoviment', 'conclude'],         to: 'authenticated-user'               },
    ])
    @cds.redirection.target: true
    entity Moviments  as projection on inventory.Moviments {
        *,
        case status
            when 'P' then 'Pendente'
            when 'A' then 'Aprovado'
            when 'R' then 'Rejeitado'
            when 'C' then 'Concluído'
            else status
        end as statusLabel : String,
        case type
            when 'E' then 'Entrada'
            when 'S' then 'Saída'
            else type
        end as typeLabel : String,
        originHistory     : Composition of many OriginStockHistory      on originHistory.moviment_ID      = ID,
        destinationHistory: Composition of many DestinationStockHistory on destinationHistory.moviment_ID = ID
    } actions {
        action approve()                                          returns Moviments;
        action rejectMoviment(@mandatory reason : String(500))    returns Moviments;
        action conclude()                                         returns Moviments;
    };

    // Value helps para enums (dados estáticos, handler em main.js)
    @readonly entity MovimentTypesVH {
        key codigo   : String(1);
            descricao: String(50);
    }

    @readonly entity MovimentStatusVH {
        key codigo   : String(1);
            descricao: String(50);
    }

    @readonly entity UsersVH as projection on auth.Users {
        key username  as usuario,
            firstName as nome,
            lastName  as sobrenome,
            active    as ativo
    };

    // Cadastro de materiais — leitura para todos, escrita para ESTOQUE e ADMIN
    @(restrict: [
        { grant: ['READ'],                       to: 'authenticated-user'   },
        { grant: ['CREATE', 'UPDATE'],           to: ['ESTOQUE', 'ADMIN']   },
        { grant: ['DELETE'],                     to: 'authenticated-user'   },
        { grant: ['toggleActive'],               to: ['ESTOQUE', 'ADMIN']   },
    ])
    entity Materials as projection on masterdata.Materials {
        key ID,
            code,
            description,
            unitMeasure,
            @mandatory: false  active  // handler defaults to true; validation at DB level
    } actions {
        action toggleActive() returns Materials;
    };

    @readonly entity UnitMeasuresVH {
        key codigo   : String(5);
            descricao: String(50);
    };

    @readonly entity CurrentUser {
        key dummy               : String(1);
            username            : String(12);
            fullName            : String(121);
            canManageMaterials  : Boolean;
            canManageMoviments  : Boolean;
            isAdmin             : Boolean;
    };

    @readonly entity CurrentUserPermissions {
        key name        : String(50);
            description : String;
    };

    action changeOwnPassword(
        @mandatory currentPassword : String,
        @mandatory newPassword     : String
    ) returns Boolean;

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
            case status
                when 'P' then 'Pendente'
                when 'A' then 'Aprovado'
                when 'R' then 'Rejeitado'
                when 'C' then 'Concluído'
                else status
            end as statusLabel : String,
            case type
                when 'E' then 'Entrada'
                when 'S' then 'Saída'
                else type
            end as typeLabel : String,
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

    @readonly @cds.persistence.skip
    entity OriginStockHistory {
        key moviment_ID     : UUID;
        key ID              : UUID;
            warehouseCode   : String(10);
            warehouseName   : String(100);
            materialCode    : String(40);
            materialDescription : String(200);
            unitMeasure     : String(10);
            lastQuantity    : Integer;
            currentQuantity : Integer;
            createdAt       : Timestamp;
            createdDate     : String(10);
            createdTime     : String(5);
    }

    @readonly @cds.persistence.skip
    entity DestinationStockHistory {
        key moviment_ID     : UUID;
        key ID              : UUID;
            warehouseCode   : String(10);
            warehouseName   : String(100);
            materialCode    : String(40);
            materialDescription : String(200);
            unitMeasure     : String(10);
            lastQuantity    : Integer;
            currentQuantity : Integer;
            createdAt       : Timestamp;
            createdDate     : String(10);
            createdTime     : String(5);
    }
}
