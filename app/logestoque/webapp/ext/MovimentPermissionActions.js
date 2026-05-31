sap.ui.define([
    "sap/m/MessageBox"
], function (MessageBox) {
    "use strict";

    var ACTIONS = {
        Aprovar: {
            permissionPath: "/canApproveMoviments",
            message: "Você não tem permissão para aprovar movimentações. Esta ação requer a permissão APROVACAO."
        },
        Rejeitar: {
            permissionPath: "/canApproveMoviments",
            message: "Você não tem permissão para rejeitar movimentações. Esta ação requer a permissão APROVACAO."
        },
        Reprovar: {
            permissionPath: "/canApproveMoviments",
            message: "Você não tem permissão para rejeitar movimentações. Esta ação requer a permissão APROVACAO."
        },
        Concluir: {
            permissionPath: "/canConcludeMoviments",
            message: "Você não tem permissão para concluir movimentações. Esta ação requer a permissão ESTOQUE."
        },
        Excluir: {
            permissionPath: "/canDeleteMoviments",
            message: "Você não tem permissão para excluir movimentações."
        },
        Delete: {
            permissionPath: "/canDeleteMoviments",
            message: "Você não tem permissão para excluir movimentações."
        }
    };

    function getOwnerComponent(oController) {
        if (oController && oController.getOwnerComponent) {
            return oController.getOwnerComponent();
        }

        if (oController && oController.base && oController.base.getOwnerComponent) {
            return oController.base.getOwnerComponent();
        }

        return null;
    }

    function getPermissionModel(oController) {
        var oComponent = getOwnerComponent(oController);
        var oModel = oComponent && oComponent.getModel && oComponent.getModel("userPerms");

        if (oModel) {
            return oModel;
        }

        var oView = oController && oController.base && oController.base.getView && oController.base.getView();
        return oView && oView.getModel && oView.getModel("userPerms");
    }

    function getView(oController) {
        return oController && oController.base && oController.base.getView && oController.base.getView();
    }

    function userHasPermission(oModel, oAction) {
        return !!(oModel && oModel.getProperty(oAction.permissionPath));
    }

    function isMovimentActionButton(oControl) {
        if (!oControl || !oControl.isA || !oControl.isA("sap.m.Button") || !oControl.getText) {
            return false;
        }

        var sText = oControl.getText();
        var sIcon = oControl.getIcon && oControl.getIcon();
        return !!ACTIONS[sText] || sIcon === "sap-icon://delete";
    }

    function installFallback(oButton, oAction) {
        if (oButton.data("movimentPermissionFallback")) {
            return;
        }

        oButton.data("movimentPermissionFallback", true);
        oButton.attachPress(function () {
            MessageBox.error(oAction.message);
        });
    }

    function applyToButton(oButton, oModel) {
        var oAction = ACTIONS[oButton.getText()];

        if (!oAction && oButton.getIcon && oButton.getIcon() === "sap-icon://delete") {
            oAction = ACTIONS.Excluir;
        }

        if (!oAction || userHasPermission(oModel, oAction)) {
            oButton.setVisible(true);
            return;
        }

        installFallback(oButton, oAction);
        oButton.setEnabled(false);
        oButton.setVisible(false);
    }

    function collectControls(oControl, aControls, mVisited) {
        var sId;
        var mAggregations;

        if (!oControl || !oControl.getId || !oControl.getMetadata) {
            return;
        }

        sId = oControl.getId();
        if (mVisited[sId]) {
            return;
        }
        mVisited[sId] = true;
        aControls.push(oControl);

        mAggregations = oControl.getMetadata().getAllAggregations();
        Object.keys(mAggregations).forEach(function (sName) {
            var vChild = oControl.getAggregation(sName);
            if (Array.isArray(vChild)) {
                vChild.forEach(function (oChild) {
                    collectControls(oChild, aControls, mVisited);
                });
            } else {
                collectControls(vChild, aControls, mVisited);
            }
        });
    }

    function apply(oController) {
        var oModel = getPermissionModel(oController);
        var aControls = [];

        if (oModel && oController && !oController._movimentPermissionActionsListening) {
            oController._movimentPermissionActionsListening = true;
            ["/canApproveMoviments", "/canConcludeMoviments", "/canDeleteMoviments"].forEach(function (sPath) {
                oModel.bindProperty(sPath).attachChange(function () {
                    apply(oController);
                });
            });
        }

        collectControls(getView(oController), aControls, {});
        aControls.forEach(function (oControl) {
            if (isMovimentActionButton(oControl)) {
                applyToButton(oControl, oModel);
            }
        });
    }

    return {
        apply: apply
    };
});
