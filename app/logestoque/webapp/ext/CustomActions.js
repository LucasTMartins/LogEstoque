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
    "sap/ui/core/Item",
    "sap/m/ComboBox"
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
    Item,
    ComboBox
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

    function getMovimentErrorMessage(oError) {
        var iStatus = Number(getStatus(oError));
        var sBackendMessage = getBackendErrorMessage(oError);

        if (iStatus === 401) {
            return "Sua sessão expirou. Faça login novamente.";
        }

        if (sBackendMessage && !isGenericHttpMessage(sBackendMessage)) {
            return sBackendMessage;
        }

        if (iStatus === 403) {
            return "Você não tem permissão para realizar esta operação.";
        }

        return "Não foi possível criar a movimentação.";
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

    function getParentTable(oControl) {
        var oCurrent = oControl;
        while (oCurrent) {
            if (oCurrent.isA && (
                oCurrent.isA("sap.ui.mdc.Table") ||
                oCurrent.isA("sap.m.Table") ||
                oCurrent.isA("sap.ui.table.Table")
            )) {
                return oCurrent;
            }
            oCurrent = oCurrent.getParent ? oCurrent.getParent() : null;
        }
        return null;
    }

    function getSelectedContexts(oTable) {
        if (!oTable) { return []; }
        // sap.ui.mdc.Table (FE v4)
        if (oTable.getSelectedContexts) {
            return oTable.getSelectedContexts();
        }
        // sap.m.Table fallback
        if (oTable.getSelectedItems) {
            return oTable.getSelectedItems()
                .map(function (oItem) { return oItem.getBindingContext(); })
                .filter(Boolean);
        }
        return [];
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

    function createMoviment(oData) {
        return fetch("/odata/v4/main/Moviments", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(oData)
        }).then(function (r) {
            if (!r.ok) {
                return r.json().then(function (oJson) {
                    var oErr = new Error(String(r.status));
                    oErr.status = r.status;
                    oErr.responseText = JSON.stringify(oJson);
                    throw oErr;
                });
            }
            return r.json();
        });
    }

    function makeSearchComboBox(placeholder) {
        return new ComboBox({
            width: "100%",
            placeholder: placeholder,
            filterSecondaryValues: false
        });
    }

    function populateComboBox(oComboBox, aItems, textFn) {
        oComboBox.removeAllItems();
        aItems.forEach(function (item) {
            oComboBox.addItem(new Item({ key: item.ID, text: textFn(item) }));
        });
    }

    return {
        onManageMaterials: function (oEvent) {
            navigateToRoute(this, oEvent, "MaterialsList");
        },

        onCreateMoviment: function (oEvent) {
            var oModel = getDefaultModel(this, oEvent);

            if (!oModel) {
                MessageBox.error("Não foi possível acessar o modelo de dados.");
                return;
            }

            var matText = function (m) { return m.code + " - " + m.description; };
            var whText  = function (w) { return w.code + " - " + w.name; };

            var oTypeSelect       = new Select({ width: "100%" });
            [{ key: "E", text: "Entrada" }, { key: "S", text: "Saída" }]
                .forEach(function (o) { oTypeSelect.addItem(new Item(o)); });

            var oMaterialComboBox    = makeSearchComboBox("Digite código ou descrição...");
            var oQuantityInput       = new Input({ type: "Number", placeholder: "1", width: "100%" });
            var oOriginLabel         = new Label({ text: "Armazém Origem", required: false });
            var oOriginComboBox      = makeSearchComboBox("Digite código ou nome...");
            var oDestinationLabel    = new Label({ text: "Armazém Destino", required: true });
            var oDestinationComboBox = makeSearchComboBox("Digite código ou nome...");
            var oObservationInput    = new Input({ placeholder: "Observação (opcional)", width: "100%" });

            var EXTERNAL_KEY = "__EXTERNO__";

            oTypeSelect.attachChange(function () {
                var bSaida = oTypeSelect.getSelectedKey() === "S";
                oOriginLabel.setRequired(bSaida);
                oDestinationLabel.setRequired(!bSaida);

                if (bSaida) {
                    if (!oDestinationComboBox.getItemByKey(EXTERNAL_KEY)) {
                        oDestinationComboBox.insertItem(
                            new Item({ key: EXTERNAL_KEY, text: "Externo / Saída para Cliente" }),
                            0
                        );
                    }
                    if (!oDestinationComboBox.getSelectedKey()) {
                        oDestinationComboBox.setSelectedKey(EXTERNAL_KEY);
                    }
                } else {
                    var oSpecialItem = oDestinationComboBox.getItemByKey(EXTERNAL_KEY);
                    if (oSpecialItem) {
                        if (oDestinationComboBox.getSelectedKey() === EXTERNAL_KEY) {
                            oDestinationComboBox.setSelectedKey("");
                        }
                        oDestinationComboBox.removeItem(oSpecialItem);
                    }
                    oOriginComboBox.setSelectedKey("");
                    oOriginComboBox.setValueState("None");
                }
            });

            Promise.all([
                fetch("/odata/v4/main/Materials?$filter=active eq true&$select=ID,code,description&$top=200").then(function (r) { return r.ok ? r.json() : { value: [] }; }),
                fetch("/odata/v4/main/Warehouses?$filter=active eq true&$select=ID,code,name&$top=200").then(function (r) { return r.ok ? r.json() : { value: [] }; })
            ]).then(function (aResults) {
                populateComboBox(oMaterialComboBox,    aResults[0].value || [], matText);
                populateComboBox(oOriginComboBox,      aResults[1].value || [], whText);
                populateComboBox(oDestinationComboBox, aResults[1].value || [], whText);
            }).catch(function () {
                MessageToast.show("Não foi possível carregar materiais e armazéns.");
            });

            var oDialog = new Dialog({
                title: "Nova Movimentação",
                contentWidth: "32rem",
                resizable: true,
                horizontalScrolling: false,
                content: new VBox({
                    width: "100%",
                    renderType: "Bare",
                    items: [
                        new Label({ text: "Tipo", required: true }),
                        oTypeSelect,
                        new Label({ text: "Material", required: true }),
                        oMaterialComboBox,
                        new Label({ text: "Quantidade", required: true }),
                        oQuantityInput,
                        oOriginLabel,
                        oOriginComboBox,
                        oDestinationLabel,
                        oDestinationComboBox,
                        new Label({ text: "Observação" }),
                        oObservationInput
                    ]
                }).addStyleClass("sapUiSmallMarginTopBottom"),
                beginButton: new Button({
                    text: "Criar",
                    type: "Emphasized",
                    press: function () {
                        var bSaida         = oTypeSelect.getSelectedKey() === "S";
                        var sMaterialID    = oMaterialComboBox.getSelectedKey();
                        var sOriginID      = oOriginComboBox.getSelectedKey();
                        var sDestinationID = oDestinationComboBox.getSelectedKey();
                        var bValid = true;

                        oMaterialComboBox.setValueState("None");
                        oQuantityInput.setValueState("None");
                        oOriginComboBox.setValueState("None");
                        oDestinationComboBox.setValueState("None");

                        if (!sMaterialID) {
                            oMaterialComboBox.setValueState("Error");
                            oMaterialComboBox.setValueStateText("Selecione um material da lista.");
                            bValid = false;
                        }

                        var sQty = oQuantityInput.getValue().trim();
                        var iQty = parseInt(sQty, 10);
                        if (!sQty || isNaN(iQty) || iQty < 1) {
                            oQuantityInput.setValueState("Error");
                            oQuantityInput.setValueStateText("Informe uma quantidade maior que zero.");
                            bValid = false;
                        }

                        if (bSaida && !sOriginID) {
                            oOriginComboBox.setValueState("Error");
                            oOriginComboBox.setValueStateText("Selecione um armazém de origem da lista.");
                            bValid = false;
                        } else if (oOriginComboBox.getValue() && !sOriginID) {
                            oOriginComboBox.setValueState("Error");
                            oOriginComboBox.setValueStateText("Valor inválido. Selecione um armazém da lista.");
                            bValid = false;
                        }

                        var sDestinationText = oDestinationComboBox.getValue().trim();
                        if (sDestinationText && !sDestinationID) {
                            oDestinationComboBox.setValueState("Error");
                            oDestinationComboBox.setValueStateText("Valor inválido. Selecione um armazém da lista.");
                            bValid = false;
                        } else if (!bSaida && !sDestinationID) {
                            oDestinationComboBox.setValueState("Error");
                            oDestinationComboBox.setValueStateText("Selecione um armazém de destino da lista.");
                            bValid = false;
                        }

                        if (!bValid) { return; }

                        var oData = {
                            type: oTypeSelect.getSelectedKey(),
                            material_ID: sMaterialID,
                            quantity: iQty
                        };
                        if (sDestinationID && sDestinationID !== EXTERNAL_KEY) {
                            oData.destinationWarehouse_ID = sDestinationID;
                        }
                        if (sOriginID) {
                            oData.originWarehouse_ID = sOriginID;
                        }
                        var sObs = oObservationInput.getValue().trim();
                        if (sObs) { oData.observation = sObs; }

                        oDialog.setBusy(true);
                        createMoviment(oData)
                            .then(function () {
                                MessageToast.show("Movimentação criada.");
                                oDialog.close();
                                refreshAfterCreate(oModel);
                            }).catch(function (oError) {
                                MessageBox.error(getMovimentErrorMessage(oError));
                            }).finally(function () {
                                oDialog.setBusy(false);
                            });
                    }
                }),
                endButton: new Button({
                    text: "Cancelar",
                    press: function () { oDialog.close(); }
                }),
                afterClose: function () { oDialog.destroy(); }
            });

            oDialog.open();
        },

        onEditDescription: function (oEvent) {
            var oModel = getDefaultModel(this, oEvent);

            if (!oModel) {
                MessageBox.error("Não foi possível acessar o modelo de dados.");
                return;
            }

            // Resolve selected contexts — three strategies in order
            var aContexts = [];

            // 1. FE v4: get table by standard ID via base controller
            if (!aContexts.length && this.base && this.base.byId) {
                var oTableById = this.base.byId("fe::table::Materials::LineItem");
                if (oTableById && oTableById.getSelectedContexts) {
                    aContexts = oTableById.getSelectedContexts() || [];
                }
            }

            // 2. Traverse parent chain from the pressed button
            if (!aContexts.length) {
                aContexts = getSelectedContexts(getParentTable(getSource(oEvent)));
            }

            // 3. Search the global UI5 element registry for any MDC table with a selection
            if (!aContexts.length) {
                try {
                    sap.ui.core.Element.registry.forEach(function (oEl) {
                        if (!aContexts.length && oEl.isA && oEl.isA("sap.ui.mdc.Table") && oEl.getSelectedContexts) {
                            var aFound = oEl.getSelectedContexts();
                            if (aFound && aFound.length) {
                                aContexts = aFound;
                            }
                        }
                    });
                } catch (e) { /* ignore */ }
            }

            if (!aContexts.length) {
                MessageBox.warning("Selecione um material para editar a descrição.");
                return;
            }

            var oCtx = aContexts[0];

            // Extract ID from binding context path (/Materials(uuid) or /Materials('uuid'))
            var sPath = oCtx && oCtx.getPath ? oCtx.getPath() : "";
            var oPathMatch = sPath.match(/Materials\(([^)]+)\)/);
            var sId = oPathMatch ? oPathMatch[1].replace(/['"]/g, "") : null;

            var oMaterial = oCtx ? oCtx.getObject() : null;
            if (!sId && oMaterial) { sId = oMaterial.ID; }

            if (!sId) {
                MessageBox.error("Não foi possível identificar o material selecionado.");
                return;
            }

            // If description isn't in the context cache, fetch it
            var sCurrentDescription = (oMaterial && oMaterial.description) || "";
            var sCode = (oMaterial && oMaterial.code) || sId;
            var oDescriptionInput = new Input({
                value: sCurrentDescription,
                width: "100%",
                placeholder: "Descrição do material"
            });

            var oDialog = new Dialog({
                title: "Editar Descrição — " + sCode,
                contentWidth: "28rem",
                content: new VBox({
                    width: "100%",
                    renderType: "Bare",
                    items: [
                        createLabel("Descrição"),
                        oDescriptionInput
                    ]
                }).addStyleClass("sapUiSmallMargin"),
                beginButton: new Button({
                    text: "Salvar",
                    type: "Emphasized",
                    press: function () {
                        var sDescription = oDescriptionInput.getValue().trim();
                        oDescriptionInput.setValueState("None");

                        if (!sDescription) {
                            oDescriptionInput.setValueState("Error");
                            oDescriptionInput.setValueStateText("Descrição é obrigatória.");
                            return;
                        }

                        oDialog.setBusy(true);
                        fetch("/odata/v4/main/Materials(" + sId + ")", {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ description: sDescription })
                        }).then(function (r) {
                            if (!r.ok) {
                                return r.json().then(function (oJson) {
                                    var oErr = new Error(String(r.status));
                                    oErr.status = r.status;
                                    oErr.responseText = JSON.stringify(oJson);
                                    throw oErr;
                                });
                            }
                            return r.json();
                        }).then(function () {
                            MessageToast.show("Descrição atualizada.");
                            oDialog.close();
                            refreshAfterCreate(oModel);
                        }).catch(function (oError) {
                            var iStatus = Number(getStatus(oError));
                            var sMsg = getBackendErrorMessage(oError);
                            if (iStatus === 403) {
                                MessageBox.error("Você não tem permissão para editar materiais. Solicite a alteração à área.");
                            } else if (sMsg && !isGenericHttpMessage(sMsg)) {
                                MessageBox.error(sMsg);
                            } else {
                                MessageBox.error("Não foi possível atualizar a descrição.");
                            }
                        }).finally(function () {
                            oDialog.setBusy(false);
                        });
                    }
                }),
                endButton: new Button({
                    text: "Cancelar",
                    press: function () { oDialog.close(); }
                }),
                afterClose: function () { oDialog.destroy(); }
            });

            oDialog.open();
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
