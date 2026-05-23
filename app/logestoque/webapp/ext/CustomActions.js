sap.ui.define([
    "sap/ui/core/routing/HashChanger"
], function (HashChanger) {
    "use strict";

    return {
        onManageMaterials: function () {
            HashChanger.getInstance().setHash("Materials");
        }
    };
});
