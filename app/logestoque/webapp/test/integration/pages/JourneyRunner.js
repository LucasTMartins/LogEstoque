sap.ui.define([
    "sap/fe/test/JourneyRunner",
	"br/dev/imlucas/logestoque/test/integration/pages/MovimentByWarehouseList",
	"br/dev/imlucas/logestoque/test/integration/pages/MovimentByWarehouseObjectPage"
], function (JourneyRunner, MovimentByWarehouseList, MovimentByWarehouseObjectPage) {
    'use strict';

    var runner = new JourneyRunner({
        launchUrl: sap.ui.require.toUrl('br/dev/imlucas/logestoque') + '/test/flp.html#app-preview',
        pages: {
			onTheMovimentByWarehouseList: MovimentByWarehouseList,
			onTheMovimentByWarehouseObjectPage: MovimentByWarehouseObjectPage
        },
        async: true
    });

    return runner;
});

