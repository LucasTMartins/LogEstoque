using MainService as service from '../../srv/main';

// ─── Moviments (entidade principal de CRUD) ───────────────────────────────────

annotate service.Moviments with @(
    UI.LineItem             : [
        {
            $Type: 'UI.DataField',
            Value: status,
            Label: 'Status',
        },
        {
            $Type: 'UI.DataField',
            Value: type,
            Label: 'Tipo',
        },
        {
            $Type: 'UI.DataField',
            Value: material.code,
            Label: 'Material',
        },
        {
            $Type: 'UI.DataField',
            Value: material.description,
            Label: 'Descrição',
        },
        {
            $Type: 'UI.DataField',
            Value: quantity,
            Label: 'Quantidade',
        },
        {
            $Type: 'UI.DataField',
            Value: originWarehouse.code,
            Label: 'Armazém Origem',
        },
        {
            $Type: 'UI.DataField',
            Value: destinationWarehouse.code,
            Label: 'Armazém Destino',
        },
        {
            $Type: 'UI.DataField',
            Value: createdAt,
            Label: 'Criado Em',
        },
        {
            $Type  : 'UI.DataFieldForAction',
            Action : 'MainService.approve',
            Label  : 'Aprovar',
        },
        {
            $Type  : 'UI.DataFieldForAction',
            Action : 'MainService.rejectMoviment',
            Label  : 'Rejeitar',
        },
        {
            $Type  : 'UI.DataFieldForAction',
            Action : 'MainService.conclude',
            Label  : 'Concluir',
        },
    ],
    UI.FieldGroup #Details  : {
        $Type: 'UI.FieldGroupType',
        Data : [
            {
                $Type: 'UI.DataField',
                Value: type,
                Label: 'Tipo de Movimentação',
            },
            {
                $Type: 'UI.DataField',
                Value: material_ID,
                Label: 'Material',
            },
            {
                $Type: 'UI.DataField',
                Value: quantity,
                Label: 'Quantidade',
            },
            {
                $Type: 'UI.DataField',
                Value: originWarehouse_ID,
                Label: 'Armazém Origem',
            },
            {
                $Type: 'UI.DataField',
                Value: destinationWarehouse_ID,
                Label: 'Armazém Destino',
            },
            {
                $Type: 'UI.DataField',
                Value: status,
                Label: 'Status',
            },
            {
                $Type: 'UI.DataField',
                Value: observation,
                Label: 'Observação',
            },
        ],
    },
    UI.Facets               : [{
        $Type : 'UI.ReferenceFacet',
        ID    : 'DetailsFacet',
        Label : 'Detalhes da Movimentação',
        Target: '@UI.FieldGroup#Details',
    }],
);

// Value helps e textos para associações em Moviments
annotate service.Moviments with {
    material             @(
        Common.Text            : material.code,
        Common.TextArrangement : #TextOnly,
        Common.ValueList       : {
            $Type          : 'Common.ValueListType',
            CollectionPath : 'Materials',
            Parameters     : [
                {
                    $Type             : 'Common.ValueListParameterOut',
                    LocalDataProperty : material_ID,
                    ValueListProperty : 'ID',
                },
                {
                    $Type             : 'Common.ValueListParameterDisplayOnly',
                    ValueListProperty : 'code',
                },
                {
                    $Type             : 'Common.ValueListParameterDisplayOnly',
                    ValueListProperty : 'description',
                },
                {
                    $Type             : 'Common.ValueListParameterDisplayOnly',
                    ValueListProperty : 'unitMeasure',
                },
            ],
        },
    );
    originWarehouse      @(
        Common.Text      : originWarehouse.code,
        Common.ValueList : {
            $Type          : 'Common.ValueListType',
            CollectionPath : 'Warehouses',
            Parameters     : [
                {
                    $Type             : 'Common.ValueListParameterOut',
                    LocalDataProperty : originWarehouse_ID,
                    ValueListProperty : 'ID',
                },
                {
                    $Type             : 'Common.ValueListParameterDisplayOnly',
                    ValueListProperty : 'code',
                },
                {
                    $Type             : 'Common.ValueListParameterDisplayOnly',
                    ValueListProperty : 'name',
                },
            ],
        },
    );
    destinationWarehouse @(
        Common.Text      : destinationWarehouse.code,
        Common.ValueList : {
            $Type          : 'Common.ValueListType',
            CollectionPath : 'Warehouses',
            Parameters     : [
                {
                    $Type             : 'Common.ValueListParameterOut',
                    LocalDataProperty : destinationWarehouse_ID,
                    ValueListProperty : 'ID',
                },
                {
                    $Type             : 'Common.ValueListParameterDisplayOnly',
                    ValueListProperty : 'code',
                },
                {
                    $Type             : 'Common.ValueListParameterDisplayOnly',
                    ValueListProperty : 'name',
                },
            ],
        },
    );
    type   @(
        Common.ValueListWithFixedValues: true,
        Common.Text                    : typeLabel,
        Common.TextArrangement         : #TextOnly,
    );
    status @(
        Core.Computed              : true,
        UI.Hidden                  : false,
        Common.ValueListWithFixedValues: true,
        Common.Text                    : statusLabel,
        Common.TextArrangement         : #TextOnly,
    );
    statusLabel @UI.Hidden;
    typeLabel   @UI.Hidden;
}

// ─── MovimentByWarehouse — anotações de campos ───────────────────────────────

annotate service.MovimentByWarehouse with {
    type   @(
        Common.ValueListWithFixedValues: true,
        Common.Text                    : typeLabel,
        Common.TextArrangement         : #TextOnly,
    );
    status @(
        Common.ValueListWithFixedValues: true,
        Common.Text                    : statusLabel,
        Common.TextArrangement         : #TextOnly,
    );
    statusLabel @UI.Hidden;
    typeLabel   @UI.Hidden;
}

// ─── MovimentByWarehouse (view desnormalizada — somente leitura) ──────────────

annotate service.MovimentByWarehouse with @(
    UI.FieldGroup #GeneratedGroup: {
        $Type: 'UI.FieldGroupType',
        Data : [
            {
                $Type: 'UI.DataField',
                Label: 'Tipo',
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
                Label: 'Quantidade',
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
                Label: 'Status',
                Value: status,
            },
            {
                $Type: 'UI.DataField',
                Label: 'Observação',
                Value: observation,
            },
        ],
    },
    UI.Facets                    : [{
        $Type : 'UI.ReferenceFacet',
        ID    : 'GeneratedFacet1',
        Label : 'General Information',
        Target: '@UI.FieldGroup#GeneratedGroup',
    }],
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
            Label: 'Status',
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
    ],
);
