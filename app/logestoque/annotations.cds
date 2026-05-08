using MainService as service from '../../srv/main';
annotate service.MovimentByWarehouse with @(
    UI.FieldGroup #GeneratedGroup : {
        $Type : 'UI.FieldGroupType',
        Data : [
            {
                $Type : 'UI.DataField',
                Label : 'type',
                Value : type,
            },
            {
                $Type : 'UI.DataField',
                Label : 'materialCode',
                Value : materialCode,
            },
            {
                $Type : 'UI.DataField',
                Label : 'materialDescription',
                Value : materialDescription,
            },
            {
                $Type : 'UI.DataField',
                Label : 'materialUnitMeasure',
                Value : materialUnitMeasure,
            },
            {
                $Type : 'UI.DataField',
                Label : 'quantity',
                Value : quantity,
            },
            {
                $Type : 'UI.DataField',
                Label : 'originWarehouseCode',
                Value : originWarehouseCode,
            },
            {
                $Type : 'UI.DataField',
                Label : 'originWarehouseName',
                Value : originWarehouseName,
            },
            {
                $Type : 'UI.DataField',
                Label : 'destinationWarehouseCode',
                Value : destinationWarehouseCode,
            },
            {
                $Type : 'UI.DataField',
                Label : 'destinationWarehouseName',
                Value : destinationWarehouseName,
            },
            {
                $Type : 'UI.DataField',
                Label : 'status',
                Value : status,
            },
            {
                $Type : 'UI.DataField',
                Label : 'observation',
                Value : observation,
            },
        ],
    },
    UI.Facets : [
        {
            $Type : 'UI.ReferenceFacet',
            ID : 'GeneratedFacet1',
            Label : 'General Information',
            Target : '@UI.FieldGroup#GeneratedGroup',
        },
    ],
    UI.LineItem : [
        {
            $Type : 'UI.DataField',
            Label : 'type',
            Value : type,
        },
        {
            $Type : 'UI.DataField',
            Label : 'materialCode',
            Value : materialCode,
        },
        {
            $Type : 'UI.DataField',
            Label : 'materialDescription',
            Value : materialDescription,
        },
        {
            $Type : 'UI.DataField',
            Label : 'materialUnitMeasure',
            Value : materialUnitMeasure,
        },
        {
            $Type : 'UI.DataField',
            Label : 'quantity',
            Value : quantity,
        },
    ],
);

