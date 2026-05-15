using MainService as service from '../../srv/main';

annotate service.MovimentByWarehouse with @(
    UI.FieldGroup #GeneratedGroup: {
        $Type: 'UI.FieldGroupType',
        Data : [
            {
                $Type: 'UI.DataField',
                Label: 'Tipo Material',
                Value: type,
            },
            {
                $Type: 'UI.DataField',
                Value: materialCode,
            },
            {
                $Type: 'UI.DataField',
                Value: materialDescription,
            },
            {
                $Type: 'UI.DataField',
                Value: materialUnitMeasure,
            },
            {
                $Type: 'UI.DataField',
                Label: 'quantity',
                Value: quantity,
            },
            {
                $Type: 'UI.DataField',
                Value: originWarehouseCode,
            },
            {
                $Type: 'UI.DataField',
                Value: originWarehouseName,
            },
            {
                $Type: 'UI.DataField',
                Value: destinationWarehouseCode,
            },
            {
                $Type: 'UI.DataField',
                Value: destinationWarehouseName,
            },
            {
                $Type: 'UI.DataField',
                Label: 'status',
                Value: status,
            },
            {
                $Type: 'UI.DataField',
                Label: 'observation',
                Value: observation,
            },
        ],
    },
    UI.Facets                    : [{
        $Type : 'UI.ReferenceFacet',
        ID    : 'GeneratedFacet1',
        Label : 'General Information',
        Target: '@UI.FieldGroup#GeneratedGroup',
    }, ],
    UI.LineItem                  : [
        {
            $Type: 'UI.DataField',
            Label: 'CD Origem',
            Value: originWarehouseCode,
        },
        {
            $Type: 'UI.DataField',
            Label: 'Nome CD Origem',
            Value: originWarehouseName,
        },
        {
            $Type: 'UI.DataField',
            Label: 'CD Destino',
            Value: destinationWarehouseCode,
        },
        {
            $Type: 'UI.DataField',
            Label: 'Nome CD Destino',
            Value: destinationWarehouseName,
        },
        {
            $Type: 'UI.DataField',
            Label: 'Código Material',
            Value: materialCode,
        },
        {
            $Type: 'UI.DataField',
            Label: 'Descrição Material',
            Value: materialDescription,
        },
        {
            $Type: 'UI.DataField',
            Label: 'Unidade Medida',
            Value: materialUnitMeasure,
        },
        {
            $Type: 'UI.DataField',
            Label: 'Quantidade',
            Value: quantity,
        },
        {
            $Type: 'UI.DataField',
            Label: 'Tipo Movimentação',
            Value: type,
        },
        {
            $Type: 'UI.DataField',
            Label: 'Status Movimentação',
            Value: status,
        },
        {
            $Type: 'UI.DataField',
            Label: 'Observação',
            Value: observation,
        },
        {
            $Type: 'UI.DataField',
            Label: 'Criado Em',
            Value: createdAt,
        },
        {
            $Type: 'UI.DataField',
            Label: 'Criado Por',
            Value: createdBy,
        },
        {
            $Type: 'UI.DataField',
            Label: 'Modificado Em',
            Value: modifiedAt,
        },
        {
            $Type: 'UI.DataField',
            Label: 'Modificado Por',
            Value: modifiedBy,
        },
    ],
);
