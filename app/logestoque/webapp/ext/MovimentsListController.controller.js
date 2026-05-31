sap.ui.define([
    "sap/ui/core/mvc/ControllerExtension",
    "br/dev/imlucas/logestoque/utils/UserMenu",
    "br/dev/imlucas/logestoque/ext/MovimentPermissionActions"
], function (ControllerExtension, UserMenu, MovimentPermissionActions) {
    "use strict";

    return ControllerExtension.extend(
        "br.dev.imlucas.logestoque.ext.MovimentsListController",
        {
            override: {
                onAfterRendering: function () {
                    UserMenu.addToDynamicPageTitle(this.base.getView(), this);
                    MovimentPermissionActions.apply(this);
                },
                routing: {
                    onAfterBinding: function () {
                        UserMenu.addToDynamicPageTitle(this.base.getView(), this);
                        MovimentPermissionActions.apply(this);
                    }
                }
            }
        }
    );
});
