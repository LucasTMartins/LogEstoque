sap.ui.define(['sap/fe/test/ListReport'], function(ListReport) {
    'use strict';

    var CustomPageDefinitions = {
        actions: {},
        assertions: {}
    };

    return new ListReport(
        {
            appId: 'br.dev.imlucas.logestoque',
            componentId: 'MovimentByWarehouseList',
            contextPath: '/MovimentByWarehouse'
        },
        CustomPageDefinitions
    );
});