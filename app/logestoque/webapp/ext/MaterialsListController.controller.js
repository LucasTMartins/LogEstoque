sap.ui.define([
    "sap/ui/core/mvc/ControllerExtension",
    "sap/m/Button"
], function (ControllerExtension, Button) {
    "use strict";

    return ControllerExtension.extend(
        "br.dev.imlucas.logestoque.ext.MaterialsListController",
        {
            override: {
                onAfterRendering: function () {
                    this._addNavBackButton();
                    this._hideShellTitle();
                },
                routing: {
                    onAfterBinding: function () {
                        this._hideShellTitle();
                    }
                }
            },

            _addNavBackButton: function () {
                var oView = this.base.getView();
                var oDynamicPage = this._findDynamicPage(oView);
                if (!oDynamicPage) { return; }

                var oTitle = oDynamicPage.getTitle();
                if (!oTitle) { return; }

                // Guard against duplicate injection on re-renders
                var bAlreadyAdded = (oTitle.getActions() || [])
                    .some(function (oBtn) { return oBtn.data("navBack") === true; });
                if (bAlreadyAdded) { return; }

                oTitle.insertAction(
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

            // The router belongs to the AppComponent. Walk up the component hierarchy
            // because getOwnerComponent() on the ListReport sub-component may not have one.
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

            _hideShellTitle: function () {
                var oView = this.base.getView();
                var oDynamicPage = this._findDynamicPage(oView);
                if (!oDynamicPage) { return; }

                oDynamicPage.addStyleClass("lge-materials-page");

                if (this._bTitleListening) { return; }
                this._bTitleListening = true;
            },

            _findDynamicPage: function (oControl) {
                if (!oControl) { return null; }
                if (oControl.isA && oControl.isA("sap.f.DynamicPage")) {
                    return oControl;
                }
                // Walk direct content children
                var aContent = (oControl.getContent && oControl.getContent()) || [];
                for (var i = 0; i < aContent.length; i++) {
                    var oFound = this._findDynamicPage(aContent[i]);
                    if (oFound) { return oFound; }
                }
                // DOM fallback: Fiori Elements may nest the page differently
                var oDom = oControl.getDomRef && oControl.getDomRef();
                if (oDom) {
                    var oDpEl = oDom.querySelector(".sapFDynamicPage");
                    return oDpEl && oDpEl.id ? sap.ui.getCore().byId(oDpEl.id) : null;
                }
                return null;
            }
        }
    );
});
