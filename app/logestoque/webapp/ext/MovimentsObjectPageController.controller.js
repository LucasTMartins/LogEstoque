sap.ui.define([
    "sap/ui/core/mvc/ControllerExtension",
    "sap/m/Button"
], function (ControllerExtension, Button) {
    "use strict";

    return ControllerExtension.extend(
        "br.dev.imlucas.logestoque.ext.MovimentsObjectPageController",
        {
            override: {
                onAfterRendering: function () {
                    this._addNavBackButton();
                },
                routing: {
                    onAfterBinding: function () {
                        this._addNavBackButton();
                    }
                }
            },

            _addNavBackButton: function () {
                var oView = this.base.getView();
                var oObjectPage = this._findObjectPageLayout(oView);
                if (!oObjectPage) { return; }

                var oHeaderTitle = oObjectPage.getHeaderTitle();
                if (!oHeaderTitle) { return; }

                var bAlreadyAdded = (oHeaderTitle.getActions() || [])
                    .some(function (oBtn) { return oBtn.data("navBack") === true; });
                if (bAlreadyAdded) { return; }

                oHeaderTitle.insertAction(
                    new Button({
                        icon: "sap-icon://nav-back",
                        text: "Voltar",
                        press: function () {
                            var oRouter = this._getAppRouter();
                            if (oRouter) {
                                oRouter.navTo("MovimentsList");
                            } else {
                                window.history.back();
                            }
                        }.bind(this)
                    }).data("navBack", true),
                    0
                );
            },

            _getAppRouter: function () {
                var oComp = this.base.getOwnerComponent();
                var oRouter;
                while (oComp) {
                    oRouter = oComp.getRouter && oComp.getRouter();
                    if (oRouter) { return oRouter; }
                    var oParent = sap.ui.core.Component.getOwnerComponentFor(oComp);
                    if (!oParent || oParent === oComp) { break; }
                    oComp = oParent;
                }
                return null;
            },

            // ObjectPage uses sap.uxap.ObjectPageLayout, not sap.f.DynamicPage
            _findObjectPageLayout: function (oControl) {
                if (!oControl) { return null; }
                if (oControl.isA && oControl.isA("sap.uxap.ObjectPageLayout")) {
                    return oControl;
                }
                var aContent = (oControl.getContent && oControl.getContent()) || [];
                for (var i = 0; i < aContent.length; i++) {
                    var oFound = this._findObjectPageLayout(aContent[i]);
                    if (oFound) { return oFound; }
                }
                var oDom = oControl.getDomRef && oControl.getDomRef();
                if (oDom) {
                    var oEl = oDom.querySelector(".sapUxAPObjectPageLayout");
                    return oEl && oEl.id ? sap.ui.getCore().byId(oEl.id) : null;
                }
                return null;
            }
        }
    );
});
