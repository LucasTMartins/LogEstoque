sap.ui.define([
    "sap/ui/core/Component",
    "sap/m/Dialog",
    "sap/m/Button",
    "sap/m/Input",
    "sap/m/Label",
    "sap/m/Select",
    "sap/m/Switch",
    "sap/m/VBox",
    "sap/m/MessageBox",
    "sap/m/MessageToast",
    "sap/ui/core/Item"
// UI5 AMD modules map one callback argument per dependency.
// eslint-disable-next-line max-params
], function (
    Component,
    Dialog,
    Button,
    Input,
    Label,
    Select,
    Switch,
    VBox,
    MessageBox,
    MessageToast,
    Item
) {
    "use strict";

    var aUnitMeasures = [
        { key: "UN", text: "Unidade" },
        { key: "KG", text: "Quilograma" },
        { key: "M", text: "Metro" },
        { key: "L", text: "Litro" },
        { key: "PC", text: "Peça" },
        { key: "CX", text: "Caixa" },
        { key: "PCT", text: "Pacote" },
        { key: "MT", text: "Metro" },
        { key: "M2", text: "Metro Quadrado" },
        { key: "M3", text: "Metro Cúbico" },
        { key: "LT", text: "Litro" },
        { key: "ML", text: "Mililitro" },
        { key: "G", text: "Grama" },
        { key: "T", text: "Tonelada" },
        { key: "SC", text: "Saco" },
        { key: "FD", text: "Fardo" },
        { key: "BL", text: "Bloco" },
        { key: "GL", text: "Galão" },
        { key: "PAR", text: "Par" },
        { key: "RL", text: "Rolo" },
        { key: "CP", text: "Corpo" },
        { key: "FRD", text: "Fardo" },
        { key: "BRT", text: "Bruto" },
        { key: "DZ", text: "Dúzia" },
        { key: "CJS", text: "Conjunto" },
        { key: "PRC", text: "Porção" },
        { key: "TD", text: "Todo" },
        { key: "RES", text: "Resma" },
        { key: "TP", text: "Tipo" },
        { key: "JG", text: "Jogo" }
    ];

    function parseJson(sValue) {
        if (typeof sValue !== "string") {
            return sValue;
        }

        try {
            return JSON.parse(sValue);
        } catch {
            return null;
        }
    }

    function normalizeMessage(vMessage) {
        if (!vMessage) {
            return "";
        }

        if (typeof vMessage === "string") {
            return vMessage;
        }

        return vMessage.value || vMessage.message || "";
    }

    function isGenericHttpMessage(sMessage) {
        var sNormalizedMessage = (sMessage || "").trim().toLowerCase();

        return sNormalizedMessage === "forbidden"
            || sNormalizedMessage === "unauthorized"
            || sNormalizedMessage === "bad request"
            || sNormalizedMessage === "internal server error";
    }

    function collectMessages(aMessages, vMessages) {
        if (!vMessages) {
            return;
        }

        if (!Array.isArray(vMessages)) {
            collectMessages(aMessages, [vMessages]);
            return;
        }

        vMessages.forEach(function (oMessage) {
            var sMessage = normalizeMessage(oMessage && (oMessage.message || oMessage.text || oMessage));

            if (sMessage && aMessages.indexOf(sMessage) === -1) {
                aMessages.push(sMessage);
            }
        });
    }

    function getPayload(oError) {
        return parseJson(oError && (oError.responseText || oError.response && oError.response.body))
            || parseJson(oError && oError.message)
            || oError;
    }

    function getBackendErrorMessage(oError) {
        var oPayload = getPayload(oError);
        var oBackendError = oPayload && (oPayload.error || oPayload);
        var aMessages = [];

        collectMessages(aMessages, oBackendError && oBackendError.details);
        collectMessages(aMessages, oBackendError && oBackendError.innererror && oBackendError.innererror.errordetails);
        collectMessages(aMessages, oBackendError && oBackendError.message);
        collectMessages(aMessages, oPayload && oPayload.message);

        return aMessages.join("\n");
    }

    function getStatus(oError) {
        var oPayload = getPayload(oError);

        return oError && (oError.status || oError.statusCode)
            || oError && oError.response && (oError.response.status || oError.response.statusCode)
            || oPayload && (oPayload.status || oPayload.statusCode)
            || oPayload && oPayload.error && (oPayload.error.status || oPayload.error.statusCode || oPayload.error.code);
    }

    function getErrorMessage(oError) {
        var iStatus = Number(getStatus(oError));
        var sBackendMessage = getBackendErrorMessage(oError);

        if (iStatus === 401) {
            return "Sua sessão expirou. Faça login novamente para criar materiais.";
        }

        if (iStatus === 403 && isGenericHttpMessage(sBackendMessage)) {
            return "Você não tem permissão para criar materiais. Solicite a criação à área.";
        }

        if (sBackendMessage && !isGenericHttpMessage(sBackendMessage)) {
            return sBackendMessage;
        }

        if (iStatus === 403) {
            return "Você não tem permissão para criar materiais. Solicite a criação à área.";
        }

        return "Não foi possível criar o material.";
    }

    function getSource(oEvent) {
        return oEvent && oEvent.getSource && oEvent.getSource();
    }

    function getOwnerComponent(oContext, oEvent) {
        if (oContext && oContext.getOwnerComponent) {
            return oContext.getOwnerComponent();
        }

        if (oContext && oContext.base && oContext.base.getOwnerComponent) {
            return oContext.base.getOwnerComponent();
        }

        var oSource = getSource(oEvent);
        return oSource && Component.getOwnerComponentFor(oSource);
    }

    function getDefaultModel(oContext, oEvent) {
        var oOwnerComponent = getOwnerComponent(oContext, oEvent);
        var oSource = getSource(oEvent);
        var oView;

        if (oOwnerComponent && oOwnerComponent.getModel) {
            return oOwnerComponent.getModel();
        }

        if (oContext && oContext.getModel) {
            return oContext.getModel();
        }

        if (oContext && oContext.getView) {
            oView = oContext.getView();
            if (oView && oView.getModel) {
                return oView.getModel();
            }
        }

        return oSource && oSource.getModel && oSource.getModel();
    }

    function navigateToRoute(oContext, oEvent, sRouteName) {
        var oOwnerComponent;
        var oRouting;

        if (oContext && oContext.routing && oContext.routing.navigateToRoute) {
            oContext.routing.navigateToRoute(sRouteName);
            return;
        }

        if (oContext && oContext.getRouting) {
            oRouting = oContext.getRouting();
        }

        if (oRouting && oRouting.navigateToRoute) {
            oRouting.navigateToRoute(sRouteName);
            return;
        }

        oOwnerComponent = getOwnerComponent(oContext, oEvent);
        if (oOwnerComponent && oOwnerComponent.getRouter) {
            oOwnerComponent.getRouter().navTo(sRouteName);
        }
    }

    function refreshAfterCreate(oModel) {
        if (oModel && oModel.refresh) {
            oModel.refresh();
        }
    }

    function createMaterial(oModel, oData) {
        var oListBinding = oModel.bindList("/Materials");
        var oContext = oListBinding.create(oData);

        return oContext.created();
    }

    function createLabel(sText) {
        return new Label({ text: sText, required: true });
    }

    function createUnitSelect() {
        var oSelect = new Select({ selectedKey: "UN", width: "100%" });

        aUnitMeasures.forEach(function (oUnit) {
            oSelect.addItem(new Item({
                key: oUnit.key,
                text: oUnit.key + " - " + oUnit.text
            }));
        });

        return oSelect;
    }

    function validateMaterialForm(oCodeInput, oDescriptionInput) {
        var sCode = oCodeInput.getValue().trim();
        var sDescription = oDescriptionInput.getValue().trim();
        var bValid = true;

        oCodeInput.setValueState("None");
        oDescriptionInput.setValueState("None");

        if (!sCode || !/^[A-Z0-9_-]+$/.test(sCode)) {
            oCodeInput.setValueState("Error");
            oCodeInput.setValueStateText("Use apenas letras maiúsculas, números, _ ou -.");
            bValid = false;
        }

        if (!sDescription) {
            oDescriptionInput.setValueState("Error");
            oDescriptionInput.setValueStateText("Descrição é obrigatória.");
            bValid = false;
        }

        return bValid;
    }

    return {
        onManageMaterials: function (oEvent) {
            navigateToRoute(this, oEvent, "MaterialsList");
        },

        onCreateMaterial: function (oEvent) {
            var oModel = getDefaultModel(this, oEvent);

            if (!oModel) {
                MessageBox.error("Não foi possível acessar o modelo de dados.");
                return;
            }

            var oCodeInput = new Input({
                placeholder: "MAT-001",
                liveChange: function () {
                    oCodeInput.setValue(oCodeInput.getValue().toUpperCase());
                }
            });
            var oDescriptionInput = new Input({ placeholder: "Descrição do material" });
            var oUnitSelect = createUnitSelect();
            var oActiveSwitch = new Switch({ state: true });

            var oDialog = new Dialog({
                title: "Novo Material",
                contentWidth: "28rem",
                content: new VBox({
                    width: "100%",
                    renderType: "Bare",
                    items: [
                        createLabel("Código"),
                        oCodeInput,
                        createLabel("Descrição"),
                        oDescriptionInput,
                        createLabel("Unidade de Medida"),
                        oUnitSelect,
                        new Label({ text: "Ativo" }),
                        oActiveSwitch
                    ]
                }).addStyleClass("sapUiSmallMargin"),
                beginButton: new Button({
                    text: "Criar",
                    type: "Emphasized",
                    press: function () {
                        if (!validateMaterialForm(oCodeInput, oDescriptionInput)) {
                            return;
                        }

                        oDialog.setBusy(true);
                        createMaterial(oModel, {
                            code: oCodeInput.getValue().trim(),
                            description: oDescriptionInput.getValue().trim(),
                            unitMeasure: oUnitSelect.getSelectedKey(),
                            active: oActiveSwitch.getState()
                        }).then(function () {
                            MessageToast.show("Material criado.");
                            oDialog.close();
                            refreshAfterCreate(oModel);
                        }).catch(function (oError) {
                            MessageBox.error(getErrorMessage(oError));
                        }).finally(function () {
                            oDialog.setBusy(false);
                        });
                    }
                }),
                endButton: new Button({
                    text: "Cancelar",
                    press: function () {
                        oDialog.close();
                    }
                }),
                afterClose: function () {
                    oDialog.destroy();
                }
            });

            oDialog.open();
        }
    };
});
