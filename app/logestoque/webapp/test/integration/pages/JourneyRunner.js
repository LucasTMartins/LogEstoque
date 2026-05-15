sap.ui.define([
    "sap/fe/test/JourneyRunner",
	"br/dev/imlucas/logestoque/test/integration/pages/MovimentByWarehouseList",
	"br/dev/imlucas/logestoque/test/integration/pages/MovimentByWarehouseObjectPage",
	"br/dev/imlucas/logestoque/test/integration/pages/MovimentDetailObjectPage"
], function (JourneyRunner, MovimentByWarehouseList, MovimentByWarehouseObjectPage, MovimentDetailObjectPage) {
    'use strict';

    var runner = new JourneyRunner({
        launchUrl: sap.ui.require.toUrl('br/dev/imlucas/logestoque') + '/test/flp.html#app-preview',
        pages: {
			onTheMovimentByWarehouseList: MovimentByWarehouseList,
			onTheMovimentByWarehouseObjectPage: MovimentByWarehouseObjectPage,
			onTheMovimentDetailObjectPage: MovimentDetailObjectPage
        },
        async: true
    });

    return runner;
});

