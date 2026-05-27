sap.ui.define([
    "sap/ui/core/mvc/ControllerExtension",
    "br/dev/imlucas/logestoque/utils/UserMenu"
], function (ControllerExtension, UserMenu) {
    "use strict";

    return ControllerExtension.extend(
        "br.dev.imlucas.logestoque.ext.MovimentsListController",
        {
            override: {
                onAfterRendering: function () {
                    UserMenu.addToDynamicPageTitle(this.base.getView(), this);
                },
                routing: {
                    onAfterBinding: function () {
                        UserMenu.addToDynamicPageTitle(this.base.getView(), this);
                    }
                }
            }
        }
    );
});
