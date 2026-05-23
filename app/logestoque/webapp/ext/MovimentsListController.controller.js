sap.ui.define([
    "sap/ui/core/mvc/ControllerExtension"
], function (ControllerExtension) {
    "use strict";

    return ControllerExtension.extend(
        "br.dev.imlucas.logestoque.ext.MovimentsListController",
        {
            override: {
                onInit: function () {
                    var oPermsModel = this.base.getOwnerComponent().getModel("userPerms");
                    if (!oPermsModel) { return; }

                    fetch("/odata/v4/main/CurrentUser('1')")
                        .then(function (r) { return r.ok ? r.json() : null; })
                        .then(function (oData) {
                            oPermsModel.setProperty("/canManageMaterials", !!(oData && oData.canManageMaterials));
                        })
                        .catch(function () { oPermsModel.setProperty("/canManageMaterials", false); });
                }
            }
        }
    );
});
