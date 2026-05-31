sap.ui.define([
    "sap/ui/core/Component",
    "sap/m/Dialog",
    "sap/m/Button",
    "sap/m/Input",
    "sap/m/Label",
    "sap/m/Select",
    "sap/m/Switch",
    "sap/m/CheckBox",
    "sap/ui/core/CustomData",
    "sap/m/VBox",
    "sap/m/Title",
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
    CheckBox,
    CustomData,
    VBox,
    Title,
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

    function getNamedModel(oContext, oEvent, sModelName) {
        var oSource = getSource(oEvent);
        var oView;
        var oComponent = getOwnerComponent(oContext, oEvent);
        var oModel;

        if (oSource && oSource.getModel) {
            oModel = oSource.getModel(sModelName);
            if (oModel) { return oModel; }
        }

        if (oContext && oContext.getModel) {
            oModel = oContext.getModel(sModelName);
            if (oModel) { return oModel; }
        }

        if (oContext && oContext.getView) {
            oView = oContext.getView();
            if (oView && oView.getModel) {
                oModel = oView.getModel(sModelName);
                if (oModel) { return oModel; }
            }
        }

        while (oComponent) {
            if (oComponent.getModel) {
                oModel = oComponent.getModel(sModelName);
                if (oModel) { return oModel; }
            }

            var oParent = Component.getOwnerComponentFor(oComponent);
            if (!oParent || oParent === oComponent) { break; }
            oComponent = oParent;
        }

        return null;
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

    function postJson(sUrl, oData) {
        return fetch(sUrl, {
            method: "POST",
            credentials: "include",
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

    function adminFetch(sUrl, oOptions) {
        return fetch(sUrl, Object.assign({ credentials: "include" }, oOptions))
            .then(function (r) {
                if (!r.ok) {
                    return r.json().then(function (oJson) {
                        var oErr = new Error(String(r.status));
                        oErr.status = r.status;
                        oErr.responseText = JSON.stringify(oJson);
                        throw oErr;
                    }).catch(function (e) {
                        if (e.status) { throw e; }
                        var oErr = new Error(String(r.status));
                        oErr.status = r.status;
                        throw oErr;
                    });
                }
                var sContentType = r.headers.get("content-type") || "";
                return sContentType.indexOf("json") !== -1 ? r.json() : true;
            });
    }

    function getUserSelectedContext(oEvent, oContext) {
        var aContexts = [];
        var oSource = getSource(oEvent);
        var oOwnerComponent = getOwnerComponent(oContext, oEvent);

        if (!aContexts.length && oContext && oContext.base && oContext.base.byId) {
            var oTableById = oContext.base.byId("fe::table::ManagedUsers::LineItem");
            if (oTableById && oTableById.getSelectedContexts) {
                aContexts = oTableById.getSelectedContexts() || [];
            }
        }

        if (!aContexts.length && oSource) {
            aContexts = getSelectedContexts(getParentTable(oSource));
        }

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

        if (!aContexts.length && oOwnerComponent && oOwnerComponent.byId) {
            var oTable = oOwnerComponent.byId("fe::table::ManagedUsers::LineItem");
            if (oTable && oTable.getSelectedContexts) {
                aContexts = oTable.getSelectedContexts() || [];
            }
        }

        return aContexts.length ? aContexts[0] : null;
    }

    function refreshUserList(oContext, oEvent) {
        var oModel = getDefaultModel(oContext, oEvent);
        refreshAfterCreate(oModel);
    }

    function openUserDialog(oContext, bCreate, oUser, aAllPerms) {
        var sTitle = bCreate ? "Novo Usuário" : "Editar Usuário: " + (oUser && oUser.username);
        var oActiveSwitch = new Switch({ state: bCreate ? true : !!(oUser && oUser.active) });
        var oFirstName = new Input({ value: bCreate ? "" : (oUser && oUser.firstName) || "", width: "100%" });
        var oLastName = new Input({ value: bCreate ? "" : (oUser && oUser.lastName) || "", width: "100%" });
        var oUsername = new Input({
            value: bCreate ? "" : (oUser && oUser.username) || "",
            editable: !!bCreate,
            width: "100%"
        });
        var oPassword = bCreate ? new Input({ type: "Password", width: "100%" }) : null;
        var oConfirm = bCreate ? new Input({ type: "Password", width: "100%" }) : null;

        var oUserPermIds = {};
        if (oUser && oUser.permissions) {
            oUser.permissions.forEach(function (p) {
                oUserPermIds[p.permission_ID] = true;
            });
        }

        var aCheckBoxes = (aAllPerms || []).map(function (perm) {
            return new CheckBox({
                text: perm.name,
                selected: !!oUserPermIds[perm.ID],
                customData: [new CustomData({ key: "permId", value: perm.ID })]
            });
        });

        var aItems = [
            new Label({ text: "Ativo" }),
            oActiveSwitch,
            new Label({ text: "Nome", required: true }),
            oFirstName,
            new Label({ text: "Sobrenome", required: true }),
            oLastName,
            new Label({ text: "Usuário", required: !!bCreate }),
            oUsername
        ];

        if (bCreate) {
            aItems.push(new Label({ text: "Senha", required: true }), oPassword);
            aItems.push(new Label({ text: "Confirmar Senha", required: true }), oConfirm);
        }

        aItems.push(new Title({ text: "Permissões", level: "H6" }).addStyleClass("sapUiSmallMarginTop"));
        aCheckBoxes.forEach(function (oCheckBox) {
            aItems.push(oCheckBox);
        });

        return { title: sTitle, activeSwitch: oActiveSwitch, firstName: oFirstName, lastName: oLastName, username: oUsername, password: oPassword, confirm: oConfirm, checkBoxes: aCheckBoxes, items: aItems };
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

        onManageUsers: function (oEvent) {
            var oUserPerms = getNamedModel(this, oEvent, "userPerms");
            var bIsAdmin = !!(oUserPerms && oUserPerms.getProperty("/isAdmin"));

            if (!bIsAdmin) {
                MessageBox.error("Você não tem permissão para acessar o gerenciamento de usuários.");
                return;
            }

            navigateToRoute(this, oEvent, "UserManagement");
        },

        onCreateUser: function (oEvent) {
            var oModel = getDefaultModel(this, oEvent);

            if (!oModel) {
                MessageBox.error("Não foi possível acessar o modelo de dados.");
                return;
            }

            adminFetch("/odata/v4/admin/Permissions?$orderby=name&$top=100")
                .then(function (oData) {
                    var oForm = openUserDialog(this, true, null, oData.value || []);
                    var oDialog = new Dialog({
                        title: oForm.title,
                        contentWidth: "30rem",
                        verticalScrolling: true,
                        content: new VBox({
                            width: "100%",
                            renderType: "Bare",
                            items: oForm.items
                        }).addStyleClass("sapUiSmallMargin"),
                        beginButton: new Button({
                            text: "Criar",
                            type: "Emphasized",
                            press: function () {
                                var aInputs = [oForm.firstName, oForm.lastName, oForm.username, oForm.password, oForm.confirm];
                                var bValid = true;
                                aInputs.forEach(function (oInput) {
                                    if (oInput) { oInput.setValueState("None"); }
                                });

                                if (!oForm.firstName.getValue().trim()) {
                                    oForm.firstName.setValueState("Error");
                                    oForm.firstName.setValueStateText("Nome é obrigatório.");
                                    bValid = false;
                                }
                                if (!oForm.lastName.getValue().trim()) {
                                    oForm.lastName.setValueState("Error");
                                    oForm.lastName.setValueStateText("Sobrenome é obrigatório.");
                                    bValid = false;
                                }
                                var sUsername = oForm.username.getValue().trim();
                                if (!sUsername || !/^[a-zA-Z0-9._-]{3,12}$/.test(sUsername)) {
                                    oForm.username.setValueState("Error");
                                    oForm.username.setValueStateText("Username: 3-12 caracteres (letras, números, ., _, -).");
                                    bValid = false;
                                }
                                if (!oForm.password.getValue() || oForm.password.getValue().length < 8) {
                                    oForm.password.setValueState("Error");
                                    oForm.password.setValueStateText("Mínimo 8 caracteres.");
                                    bValid = false;
                                } else if (oForm.password.getValue() !== oForm.confirm.getValue()) {
                                    oForm.confirm.setValueState("Error");
                                    oForm.confirm.setValueStateText("As senhas não coincidem.");
                                    bValid = false;
                                }
                                if (!bValid) { return; }

                                oDialog.setBusy(true);
                                postJson("/odata/v4/admin/createUser", {
                                    username: sUsername,
                                    firstName: oForm.firstName.getValue().trim(),
                                    lastName: oForm.lastName.getValue().trim(),
                                    password: oForm.password.getValue(),
                                    active: oForm.activeSwitch.getState(),
                                    permissions: oForm.checkBoxes
                                        .filter(function (oCheckBox) { return oCheckBox.getSelected(); })
                                        .map(function (oCheckBox) { return oCheckBox.data("permId"); })
                                }).then(function () {
                                    MessageToast.show("Usuário criado com sucesso.");
                                    oDialog.close();
                                    refreshUserList(this, oEvent);
                                }.bind(this)).catch(function (oError) {
                                    MessageBox.error(getBackendErrorMessage(oError) || "Não foi possível criar o usuário.");
                                }).finally(function () {
                                    oDialog.setBusy(false);
                                });
                            }.bind(this)
                        }),
                        endButton: new Button({
                            text: "Cancelar",
                            press: function () { oDialog.close(); }
                        }),
                        afterClose: function () { oDialog.destroy(); }
                    });

                    oDialog.open();
                }.bind(this))
                .catch(function (oError) {
                    MessageBox.error(getBackendErrorMessage(oError) || "Não foi possível carregar as permissões.");
                });
        },

        onEditUser: function (oEvent) {
            var oContext = getUserSelectedContext(oEvent, this);

            if (!oContext) {
                MessageBox.warning("Selecione um usuário para editar.");
                return;
            }

            var oUser = oContext.getObject();
            if (!oUser || !oUser.ID) {
                MessageBox.warning("Selecione um usuário válido.");
                return;
            }

            Promise.all([
                adminFetch("/odata/v4/admin/Users(" + oUser.ID + ")?$expand=permissions($expand=permission)"),
                adminFetch("/odata/v4/admin/Permissions?$orderby=name&$top=100")
            ]).then(function (aResults) {
                var oLoadedUser = aResults[0];
                var aPerms = aResults[1].value || [];
                var oForm = openUserDialog(this, false, oLoadedUser, aPerms);
                var oDialog = new Dialog({
                    title: oForm.title,
                    contentWidth: "30rem",
                    verticalScrolling: true,
                    content: new VBox({
                        width: "100%",
                        renderType: "Bare",
                        items: oForm.items
                    }).addStyleClass("sapUiSmallMargin"),
                    beginButton: new Button({
                        text: "Salvar",
                        type: "Emphasized",
                        press: function () {
                            var bValid = true;
                            [oForm.firstName, oForm.lastName, oForm.username].forEach(function (oInput) {
                                oInput.setValueState("None");
                            });
                            if (!oForm.firstName.getValue().trim()) {
                                oForm.firstName.setValueState("Error");
                                oForm.firstName.setValueStateText("Nome é obrigatório.");
                                bValid = false;
                            }
                            if (!oForm.lastName.getValue().trim()) {
                                oForm.lastName.setValueState("Error");
                                oForm.lastName.setValueStateText("Sobrenome é obrigatório.");
                                bValid = false;
                            }
                            if (!bValid) { return; }

                            oDialog.setBusy(true);
                            var aSteps = [
                                adminFetch("/odata/v4/admin/Users(" + oLoadedUser.ID + ")", {
                                    method: "PATCH",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({
                                        firstName: oForm.firstName.getValue().trim(),
                                        lastName: oForm.lastName.getValue().trim()
                                    })
                                })
                            ];

                            if (!!oForm.activeSwitch.getState() !== !!oLoadedUser.active) {
                                aSteps.push(adminFetch("/odata/v4/admin/Users(" + oLoadedUser.ID + ")/AdminService.toggleActive", {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    body: "{}"
                                }));
                            }

                            var oOldPermIds = {};
                            (oLoadedUser.permissions || []).forEach(function (p) {
                                oOldPermIds[p.permission_ID] = true;
                            });

                            oForm.checkBoxes.forEach(function (oCheckBox) {
                                var sPermId = oCheckBox.data("permId");
                                var bChecked = oCheckBox.getSelected();
                                var bHad = !!oOldPermIds[sPermId];
                                if (bChecked && !bHad) {
                                    aSteps.push(adminFetch("/odata/v4/admin/Users(" + oLoadedUser.ID + ")/AdminService.assignPermission", {
                                        method: "POST",
                                        headers: { "Content-Type": "application/json" },
                                        body: JSON.stringify({ permissionId: sPermId })
                                    }));
                                } else if (!bChecked && bHad) {
                                    aSteps.push(adminFetch("/odata/v4/admin/Users(" + oLoadedUser.ID + ")/AdminService.revokePermission", {
                                        method: "POST",
                                        headers: { "Content-Type": "application/json" },
                                        body: JSON.stringify({ permissionId: sPermId })
                                    }));
                                }
                            });

                            Promise.all(aSteps).then(function () {
                                MessageToast.show("Usuário atualizado.");
                                oDialog.close();
                                refreshUserList(this, oEvent);
                            }.bind(this)).catch(function (oError) {
                                MessageBox.error(getBackendErrorMessage(oError) || "Não foi possível salvar as alterações.");
                            }).finally(function () {
                                oDialog.setBusy(false);
                            });
                        }.bind(this)
                    }),
                    endButton: new Button({
                        text: "Cancelar",
                        press: function () { oDialog.close(); }
                    }),
                    afterClose: function () { oDialog.destroy(); }
                });

                oDialog.open();
            }.bind(this)).catch(function (oError) {
                MessageBox.error(getBackendErrorMessage(oError) || "Não foi possível carregar o usuário.");
            });
        },

        onResetUserPassword: function (oEvent) {
            var oContext = getUserSelectedContext(oEvent, this);

            if (!oContext) {
                MessageBox.warning("Selecione um usuário para redefinir a senha.");
                return;
            }

            var oUser = oContext.getObject();
            if (!oUser || !oUser.ID) {
                MessageBox.warning("Selecione um usuário válido.");
                return;
            }

            var oPassword = new Input({ type: "Password", width: "100%" });
            var oConfirm = new Input({ type: "Password", width: "100%" });
            var oDialog = new Dialog({
                title: "Redefinir Senha: " + (oUser.username || ""),
                contentWidth: "26rem",
                content: new VBox({
                    width: "100%",
                    renderType: "Bare",
                    items: [
                        new Label({ text: "Nova Senha", required: true }),
                        oPassword,
                        new Label({ text: "Confirmar Senha", required: true }),
                        oConfirm,
                        new Title({ text: "Mínimo 8 caracteres.", level: "H6" })
                    ]
                }).addStyleClass("sapUiSmallMargin"),
                beginButton: new Button({
                    text: "Confirmar",
                    type: "Emphasized",
                    press: function () {
                        oPassword.setValueState("None");
                        oConfirm.setValueState("None");

                        var sPassword = oPassword.getValue();
                        if (!sPassword || sPassword.length < 8) {
                            oPassword.setValueState("Error");
                            oPassword.setValueStateText("Mínimo 8 caracteres.");
                            return;
                        }
                        if (sPassword !== oConfirm.getValue()) {
                            oConfirm.setValueState("Error");
                            oConfirm.setValueStateText("As senhas não coincidem.");
                            return;
                        }

                        oDialog.setBusy(true);
                        adminFetch("/odata/v4/admin/Users(" + oUser.ID + ")/AdminService.resetPassword", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ newPassword: sPassword })
                        }).then(function () {
                            MessageToast.show("Senha redefinida com sucesso.");
                            oDialog.close();
                        }).catch(function (oError) {
                            MessageBox.error(getBackendErrorMessage(oError) || "Não foi possível redefinir a senha.");
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

        onCreateWarehouse: function (oEvent) {
            var oModel = getDefaultModel(this, oEvent);

            if (!oModel) {
                MessageBox.error("Não foi possível acessar o modelo de dados.");
                return;
            }

            var oCode = new Input({ width: "100%", placeholder: "W001" });
            var oName = new Input({ width: "100%", placeholder: "Depósito Central" });
            var oCapacity = new Input({ type: "Number", width: "100%", placeholder: "1000" });
            var oDistributionCenter = makeSearchComboBox("Selecione um centro de distribuição...");
            var oActive = new Switch({ state: true });

            function resetStates() {
                [oCode, oName, oCapacity, oDistributionCenter].forEach(function (oInput) {
                    oInput.setValueState("None");
                    oInput.setValueStateText("");
                });
            }

            fetch("/odata/v4/main/DistributionCenters?$filter=active eq true&$select=ID,code,name&$orderby=code&$top=200", {
                credentials: "include"
            }).then(function (r) {
                return r.ok ? r.json() : { value: [] };
            }).then(function (oData) {
                populateComboBox(oDistributionCenter, oData.value || [], function (dc) {
                    return dc.code + " - " + dc.name;
                });
            }).catch(function () {
                MessageToast.show("Não foi possível carregar centros de distribuição.");
            });

            var oDialog = new Dialog({
                title: "Novo Depósito",
                contentWidth: "32rem",
                resizable: true,
                horizontalScrolling: false,
                content: new VBox({
                    width: "100%",
                    renderType: "Bare",
                    items: [
                        createLabel("Código"),
                        oCode,
                        createLabel("Nome"),
                        oName,
                        createLabel("Capacidade"),
                        oCapacity,
                        createLabel("Centro de Distribuição"),
                        oDistributionCenter,
                        new Label({ text: "Ativo" }),
                        oActive
                    ]
                }).addStyleClass("sapUiSmallMarginTopBottom"),
                beginButton: new Button({
                    text: "Criar",
                    type: "Emphasized",
                    press: function () {
                        var sCode = oCode.getValue().trim();
                        var sName = oName.getValue().trim();
                        var sCapacity = oCapacity.getValue().trim();
                        var iCapacity = parseInt(sCapacity, 10);
                        var sDistributionCenterId = oDistributionCenter.getSelectedKey();
                        var bValid = true;

                        resetStates();

                        if (!sCode || !/^[A-Z0-9_-]+$/.test(sCode)) {
                            oCode.setValueState("Error");
                            oCode.setValueStateText("Use apenas letras maiúsculas, números, _ ou -.");
                            bValid = false;
                        }
                        if (!sName) {
                            oName.setValueState("Error");
                            oName.setValueStateText("Nome é obrigatório.");
                            bValid = false;
                        }
                        if (!sCapacity || isNaN(iCapacity) || iCapacity < 0) {
                            oCapacity.setValueState("Error");
                            oCapacity.setValueStateText("Informe uma capacidade maior ou igual a zero.");
                            bValid = false;
                        }
                        if (!sDistributionCenterId) {
                            oDistributionCenter.setValueState("Error");
                            oDistributionCenter.setValueStateText("Selecione um centro de distribuição existente.");
                            bValid = false;
                        }

                        if (!bValid) { return; }

                        oDialog.setBusy(true);
                        postJson("/odata/v4/main/createWarehouse", {
                            code: sCode,
                            name: sName,
                            capacity: iCapacity,
                            distributionCenterId: sDistributionCenterId,
                            active: oActive.getState()
                        }).then(function () {
                            MessageToast.show("Depósito criado.");
                            oDialog.close();
                            refreshAfterCreate(oModel);
                        }).catch(function (oError) {
                            MessageBox.error(getBackendErrorMessage(oError) || "Não foi possível criar o depósito.");
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

        onCreateDistributionCenter: function (oEvent) {
            var oModel = getDefaultModel(this, oEvent);

            if (!oModel) {
                MessageBox.error("Não foi possível acessar o modelo de dados.");
                return;
            }

            var oCode = new Input({ width: "100%", placeholder: "D001" });
            var oName = new Input({ width: "100%", placeholder: "CD São Paulo" });
            var oStreet = new Input({ width: "100%" });
            var oNumber = new Input({ width: "100%" });
            var oDistrict = new Input({ width: "100%" });
            var oTown = new Input({ width: "100%" });
            var oState = new Input({ width: "100%", placeholder: "SP" });
            var oCountry = new Input({ width: "100%", value: "032" });
            var oZipCode = new Input({ width: "100%", placeholder: "01310-100" });
            var oObservation = new Input({ width: "100%" });
            var oActive = new Switch({ state: true });

            function resetStates() {
                [oCode, oName, oStreet, oNumber, oDistrict, oTown, oState, oCountry, oZipCode].forEach(function (oInput) {
                    oInput.setValueState("None");
                    oInput.setValueStateText("");
                });
            }

            function requireValue(oInput, sMessage) {
                if (oInput.getValue().trim()) { return true; }
                oInput.setValueState("Error");
                oInput.setValueStateText(sMessage);
                return false;
            }

            var oDialog = new Dialog({
                title: "Novo Centro de Distribuição",
                contentWidth: "36rem",
                resizable: true,
                horizontalScrolling: false,
                content: new VBox({
                    width: "100%",
                    renderType: "Bare",
                    items: [
                        createLabel("Código"),
                        oCode,
                        createLabel("Nome"),
                        oName,
                        createLabel("Logradouro"),
                        oStreet,
                        createLabel("Número"),
                        oNumber,
                        createLabel("Bairro"),
                        oDistrict,
                        createLabel("Cidade"),
                        oTown,
                        createLabel("UF"),
                        oState,
                        createLabel("País"),
                        oCountry,
                        createLabel("CEP"),
                        oZipCode,
                        new Label({ text: "Observação" }),
                        oObservation,
                        new Label({ text: "Ativo" }),
                        oActive
                    ]
                }).addStyleClass("sapUiSmallMarginTopBottom"),
                beginButton: new Button({
                    text: "Criar",
                    type: "Emphasized",
                    press: function () {
                        var bValid;
                        var sCode = oCode.getValue().trim();
                        var sZipCode = oZipCode.getValue().trim();

                        resetStates();
                        bValid = [
                            requireValue(oCode, "Código é obrigatório."),
                            requireValue(oName, "Nome é obrigatório."),
                            requireValue(oStreet, "Logradouro é obrigatório."),
                            requireValue(oNumber, "Número é obrigatório."),
                            requireValue(oDistrict, "Bairro é obrigatório."),
                            requireValue(oTown, "Cidade é obrigatória."),
                            requireValue(oState, "UF é obrigatória."),
                            requireValue(oCountry, "País é obrigatório."),
                            requireValue(oZipCode, "CEP é obrigatório.")
                        ].every(Boolean);

                        if (sCode && !/^[A-Z0-9_-]+$/.test(sCode)) {
                            oCode.setValueState("Error");
                            oCode.setValueStateText("Use apenas letras maiúsculas, números, _ ou -.");
                            bValid = false;
                        }
                        if (sZipCode && !/^[0-9]{5}-?[0-9]{3}$/.test(sZipCode)) {
                            oZipCode.setValueState("Error");
                            oZipCode.setValueStateText("Informe um CEP válido.");
                            bValid = false;
                        }

                        if (!bValid) { return; }

                        oDialog.setBusy(true);
                        postJson("/odata/v4/main/createDistributionCenterWithAddress", {
                            code: sCode,
                            name: oName.getValue().trim(),
                            street: oStreet.getValue().trim(),
                            number: oNumber.getValue().trim(),
                            district: oDistrict.getValue().trim(),
                            town: oTown.getValue().trim(),
                            state: oState.getValue().trim(),
                            country_code: oCountry.getValue().trim(),
                            zipCode: sZipCode,
                            observation: oObservation.getValue().trim() || null,
                            active: oActive.getState()
                        }).then(function () {
                            MessageToast.show("Centro de distribuição criado.");
                            oDialog.close();
                            refreshAfterCreate(oModel);
                        }).catch(function (oError) {
                            MessageBox.error(getBackendErrorMessage(oError) || "Não foi possível criar o centro de distribuição.");
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
