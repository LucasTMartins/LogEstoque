using MainService as service from '../../srv/main';

// ─── Moviments (entidade principal de CRUD) ───────────────────────────────────

annotate service.Moviments with @cds.search: {
    material.code       : true,
    material.description: true,
    statusLabel         : true,
    typeLabel           : true,
};

annotate service.Moviments with @(
    UI.HeaderInfo         : {
        TypeName      : 'Movimentação',
        TypeNamePlural: 'Movimentações',
        Title         : {
            $Type: 'UI.DataField',
            Value: typeLabel,
        },
        Description   : {
            $Type: 'UI.DataField',
            Value: statusLabel,
        },
    },
    UI.SelectionFields    : [
        status,
        type,
        material,
        originWarehouse,
        destinationWarehouse,
        createdAt,
        createdBy,
    ],
    UI.LineItem           : [
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
            $Type : 'UI.DataFieldForAction',
            Action: 'MainService.approve',
            Label : 'Aprovar',
        },
        {
            $Type : 'UI.DataFieldForAction',
            Action: 'MainService.rejectMoviment',
            Label : 'Rejeitar',
        },
        {
            $Type : 'UI.DataFieldForAction',
            Action: 'MainService.conclude',
            Label : 'Concluir',
        },
    ],
    UI.FieldGroup #Details: {
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
    UI.Facets             : [{
        $Type : 'UI.ReferenceFacet',
        ID    : 'DetailsFacet',
        Label : 'Detalhes da Movimentação',
        Target: '@UI.FieldGroup#Details',
    }],
);

// Value helps e textos para associações em Moviments
annotate service.Moviments with {
    material             @title: 'Material' @(
        Common.Text           : material.code,
        Common.TextArrangement: #TextOnly,
        Common.ValueList      : {
            $Type         : 'Common.ValueListType',
            CollectionPath: 'Materials',
            Parameters    : [
                {
                    $Type            : 'Common.ValueListParameterOut',
                    LocalDataProperty: material_ID,
                    ValueListProperty: 'ID',
                },
                {
                    $Type            : 'Common.ValueListParameterDisplayOnly',
                    ValueListProperty: 'code',
                },
                {
                    $Type            : 'Common.ValueListParameterDisplayOnly',
                    ValueListProperty: 'description',
                },
                {
                    $Type            : 'Common.ValueListParameterDisplayOnly',
                    ValueListProperty: 'unitMeasure',
                },
            ],
        },
    );
    originWarehouse      @title: 'Armazém Origem' @(
        Common.Text     : originWarehouse.code,
        Common.ValueList: {
            $Type         : 'Common.ValueListType',
            CollectionPath: 'Warehouses',
            Parameters    : [
                {
                    $Type            : 'Common.ValueListParameterOut',
                    LocalDataProperty: originWarehouse_ID,
                    ValueListProperty: 'ID',
                },
                {
                    $Type            : 'Common.ValueListParameterDisplayOnly',
                    ValueListProperty: 'code',
                },
                {
                    $Type            : 'Common.ValueListParameterDisplayOnly',
                    ValueListProperty: 'name',
                },
            ],
        },
    );
    destinationWarehouse @title: 'Armazém Destino' @(
        Common.Text     : destinationWarehouse.code,
        Common.ValueList: {
            $Type         : 'Common.ValueListType',
            CollectionPath: 'Warehouses',
            Parameters    : [
                {
                    $Type            : 'Common.ValueListParameterOut',
                    LocalDataProperty: destinationWarehouse_ID,
                    ValueListProperty: 'ID',
                },
                {
                    $Type            : 'Common.ValueListParameterDisplayOnly',
                    ValueListProperty: 'code',
                },
                {
                    $Type            : 'Common.ValueListParameterDisplayOnly',
                    ValueListProperty: 'name',
                },
            ],
        },
    );
    type   @title: 'Tipo' @(
        Common.Text          : typeLabel,
        Common.TextArrangement: #TextOnly,
        Common.ValueList     : {
            $Type         : 'Common.ValueListType',
            CollectionPath: 'MovimentTypesVH',
            Parameters    : [
                {
                    $Type            : 'Common.ValueListParameterOut',
                    LocalDataProperty: type,
                    ValueListProperty: 'codigo',
                },
                {
                    $Type            : 'Common.ValueListParameterDisplayOnly',
                    ValueListProperty: 'descricao',
                },
            ],
        },
    );
    status @title: 'Status' @(
        Core.Computed        : true,
        UI.Hidden            : false,
        Common.Text          : statusLabel,
        Common.TextArrangement: #TextOnly,
        Common.ValueList     : {
            $Type         : 'Common.ValueListType',
            CollectionPath: 'MovimentStatusVH',
            Parameters    : [
                {
                    $Type            : 'Common.ValueListParameterOut',
                    LocalDataProperty: status,
                    ValueListProperty: 'codigo',
                },
                {
                    $Type            : 'Common.ValueListParameterDisplayOnly',
                    ValueListProperty: 'descricao',
                },
            ],
        },
    );
    statusLabel @UI.Hidden;
    typeLabel   @UI.Hidden;
}

// ─── Moviments — campos gerenciados ──────────────────────────────────────────

annotate service.Moviments with {
    ID                   @UI.Hidden;
    createdAt @title: 'Data Criação' @UI.HiddenFilter: false @odata.Type: 'Edm.Date';
    createdBy @title: 'Criado Por'  @UI.HiddenFilter: false @(
        Common.ValueList: {
            $Type         : 'Common.ValueListType',
            CollectionPath: 'UsersVH',
            Parameters    : [
                {
                    $Type            : 'Common.ValueListParameterOut',
                    LocalDataProperty: createdBy,
                    ValueListProperty: 'usuario',
                },
                {
                    $Type            : 'Common.ValueListParameterDisplayOnly',
                    ValueListProperty: 'nome',
                },
                {
                    $Type            : 'Common.ValueListParameterDisplayOnly',
                    ValueListProperty: 'sobrenome',
                },
            ],
        },
    );
    modifiedAt @title: 'Alterado Em' @UI.HiddenFilter: false @odata.Type: 'Edm.Date';
    modifiedBy @title: 'Alterado Por' @UI.HiddenFilter: false @(
        Common.ValueList: {
            $Type         : 'Common.ValueListType',
            CollectionPath: 'UsersVH',
            Parameters    : [
                {
                    $Type            : 'Common.ValueListParameterOut',
                    LocalDataProperty: modifiedBy,
                    ValueListProperty: 'usuario',
                },
                {
                    $Type            : 'Common.ValueListParameterDisplayOnly',
                    ValueListProperty: 'nome',
                },
                {
                    $Type            : 'Common.ValueListParameterDisplayOnly',
                    ValueListProperty: 'sobrenome',
                },
            ],
        },
    );
    observation          @title: 'Observação';
    quantity             @title: 'Quantidade';
}

// ─── Materials — cadastro de materiais ───────────────────────────────────────

annotate service.Materials with @(
    Capabilities.InsertRestrictions: { Insertable: true },
    Capabilities.UpdateRestrictions: { Updatable:  true },
    Capabilities.DeleteRestrictions: { Deletable:  true },
);

annotate service.Materials with {
    ID          @UI.Hidden;
    code        @title: 'Código';
    description @title: 'Descrição';
    unitMeasure @title: 'Unidade de Medida' @(
        Common.ValueListWithFixedValues: true,
        Common.ValueList               : {
            $Type         : 'Common.ValueListType',
            CollectionPath: 'UnitMeasuresVH',
            Parameters    : [
                {
                    $Type            : 'Common.ValueListParameterOut',
                    LocalDataProperty: unitMeasure,
                    ValueListProperty: 'codigo',
                },
                {
                    $Type            : 'Common.ValueListParameterDisplayOnly',
                    ValueListProperty: 'descricao',
                },
            ],
        },
    );
    active      @title: 'Ativo';
}

annotate service.Materials with @(
    UI.HeaderInfo         : {
        TypeName      : 'Material',
        TypeNamePlural: 'Materiais',
        Title         : {
            $Type: 'UI.DataField',
            Value: code,
        },
        Description   : {
            $Type: 'UI.DataField',
            Value: description,
        },
    },
    UI.SelectionFields    : [code, description, active],
    UI.LineItem           : [
        {
            $Type: 'UI.DataField',
            Value: code,
            Label: 'Código',
        },
        {
            $Type: 'UI.DataField',
            Value: description,
            Label: 'Descrição',
        },
        {
            $Type: 'UI.DataField',
            Value: unitMeasure,
            Label: 'Unidade',
        },
        {
            $Type: 'UI.DataField',
            Value: active,
            Label: 'Ativo',
        },
        {
            $Type : 'UI.DataFieldForAction',
            Action: 'MainService.toggleActive',
            Label : 'Ativar/Desativar',
        },
    ],
);

// ─── MovimentByWarehouse — anotações de campos ───────────────────────────────

annotate service.MovimentByWarehouse with {
    ID                       @UI.Hidden;
    createdAt                @title: 'Criado Em';
    createdBy                @title: 'Criado Por';
    modifiedAt               @title: 'Alterado Em';
    modifiedBy               @title: 'Alterado Por';
    observation              @title: 'Observação';
    materialCode             @title: 'Material';
    originWarehouseCode      @title: 'Armazém Origem';
    destinationWarehouseCode @title: 'Armazém Destino';
    type   @(
        Common.Text           : typeLabel,
        Common.TextArrangement: #TextOnly,
        Common.ValueList      : {
            $Type         : 'Common.ValueListType',
            CollectionPath: 'MovimentTypesVH',
            Parameters    : [
                {
                    $Type            : 'Common.ValueListParameterOut',
                    LocalDataProperty: type,
                    ValueListProperty: 'codigo',
                },
                {
                    $Type            : 'Common.ValueListParameterDisplayOnly',
                    ValueListProperty: 'descricao',
                },
            ],
        },
    );
    status @(
        Common.Text           : statusLabel,
        Common.TextArrangement: #TextOnly,
        Common.ValueList      : {
            $Type         : 'Common.ValueListType',
            CollectionPath: 'MovimentStatusVH',
            Parameters    : [
                {
                    $Type            : 'Common.ValueListParameterOut',
                    LocalDataProperty: status,
                    ValueListProperty: 'codigo',
                },
                {
                    $Type            : 'Common.ValueListParameterDisplayOnly',
                    ValueListProperty: 'descricao',
                },
            ],
        },
    );
    statusLabel @UI.Hidden;
    typeLabel   @UI.Hidden;
}

// ─── MovimentByWarehouse (view desnormalizada — somente leitura) ──────────────

annotate service.MovimentByWarehouse with @(
    UI.SelectionFields           : [
        status,
        type,
        materialCode,
        originWarehouseCode,
        destinationWarehouseCode,
        createdAt,
        createdBy,
    ],
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
                Label: 'Código Armazém Origem',
                Value: originWarehouseCode,
            },
            {
                $Type: 'UI.DataField',
                Label: 'Nome Armazém Origem',
                Value: originWarehouseName,
            },
            {
                $Type: 'UI.DataField',
                Label: 'Código Armazém Destino',
                Value: destinationWarehouseCode,
            },
            {
                $Type: 'UI.DataField',
                Label: 'Nome Armazém Destino',
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
        Label : 'Informações Gerais',
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

// ─── MovimentDetail — anotações de campos e layout ───────────────────────────

annotate service.MovimentDetail with {
    ID                  @UI.Hidden;
    createdAt           @title: 'Criado Em';
    createdBy           @title: 'Criado Por';
    modifiedAt          @title: 'Alterado Em';
    modifiedBy          @title: 'Alterado Por';
    moviment            @UI.Hidden;
    lastQuantity        @title: 'Quantidade Anterior';
    currentQuantity     @title: 'Quantidade Atual';
    observation         @title: 'Observação';
    materialCode        @title: 'Código Material';
    materialDescription @title: 'Descrição Material';
    materialUnitMeasure @title: 'Unidade Medida';
    warehouseCode       @title: 'Código Armazém';
    warehouseName       @title: 'Nome Armazém';
    movimentQuantity    @title: 'Quantidade Movimentada';
    type                @(
        Common.ValueListWithFixedValues: true,
        Common.Text                    : typeLabel,
        Common.TextArrangement         : #TextOnly,
    );
    status              @(
        Common.ValueListWithFixedValues: true,
        Common.Text                    : statusLabel,
        Common.TextArrangement         : #TextOnly,
    );
}

annotate service.MovimentDetail with @(UI.LineItem: [
    {
        $Type: 'UI.DataField',
        Label: 'Código Armazém',
        Value: warehouseCode,
    },
    {
        $Type: 'UI.DataField',
        Label: 'Nome Armazém',
        Value: warehouseName,
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
        Label: 'Quantidade Anterior',
        Value: lastQuantity,
    },
    {
        $Type: 'UI.DataField',
        Label: 'Quantidade Atual',
        Value: currentQuantity,
    },
], );
