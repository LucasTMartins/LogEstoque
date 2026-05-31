sap.ui.define([
    "sap/ui/core/mvc/ControllerExtension",
    "sap/ui/core/CustomData",
    "sap/m/Button",
    "sap/m/Dialog",
    "sap/m/Input",
    "sap/m/Label",
    "sap/m/Switch",
    "sap/m/CheckBox",
    "sap/m/VBox",
    "sap/m/Title",
    "sap/m/Text",
    "sap/m/MessageBox",
    "sap/m/MessageToast",
    "br/dev/imlucas/logestoque/utils/UserMenu"
// eslint-disable-next-line max-params
], function (
    ControllerExtension,
    CustomData,
    Button,
    Dialog,
    Input,
    Label,
    Switch,
    CheckBox,
    VBox,
    Title,
    Text,
    MessageBox,
    MessageToast,
    UserMenu
) {
    "use strict";

    function parseJson(v) {
        if (typeof v !== "string") return v;
        try { return JSON.parse(v); } catch (e) { return null; }
    }

    function normalizeMessage(v) {
        if (!v) return "";
        if (typeof v === "string") return v;
        return v.value || v.message || "";
    }

    function collectMessages(aOut, vMessages) {
        if (!vMessages) return;
        if (!Array.isArray(vMessages)) {
            collectMessages(aOut, [vMessages]);
            return;
        }
        vMessages.forEach(function (m) {
            var s = normalizeMessage(m && (m.message || m.text || m));
            if (s && aOut.indexOf(s) === -1) aOut.push(s);
        });
    }

    function getBackendMessage(oError) {
        var oPayload = parseJson(oError && (oError.responseText || (oError.response && oError.response.body)))
            || parseJson(oError && oError.message) || oError;
        var oErr = oPayload && (oPayload.error || oPayload);
        var aMessages = [];
        collectMessages(aMessages, oErr && oErr.details);
        collectMessages(aMessages, oErr && oErr.innererror && oErr.innererror.errordetails);
        collectMessages(aMessages, oErr && oErr.message);
        collectMessages(aMessages, oPayload && oPayload.message);
        return aMessages.join("\n");
    }

    function getStatus(oError) {
        var oPayload = parseJson(oError && (oError.responseText || (oError.response && oError.response.body)))
            || parseJson(oError && oError.message) || oError;
        return (oError && (oError.status || oError.statusCode))
            || (oError && oError.response && (oError.response.status || oError.response.statusCode))
            || (oPayload && (oPayload.status || oPayload.statusCode))
            || (oPayload && oPayload.error && (oPayload.error.status || oPayload.error.code));
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
                        if (e.status) throw e;
                        var oErr = new Error(String(r.status));
                        oErr.status = r.status;
                        throw oErr;
                    });
                }
                var sContentType = r.headers.get("content-type") || "";
                return sContentType.indexOf("json") !== -1 ? r.json() : true;
            });
    }

    function showError(oError, sFallback) {
        var sMsg = getBackendMessage(oError);
        var iStatus = Number(getStatus(oError));
        if (iStatus === 401) {
            MessageBox.error("Sua sessão expirou. Faça login novamente.");
            return;
        }
        MessageBox.error(sMsg || sFallback || "Ocorreu um erro inesperado.");
    }

    return ControllerExtension.extend(
        "br.dev.imlucas.logestoque.ext.UsersListController",
        {
            override: {
                onAfterRendering: function () {
                    this._addNavBackButton();
                    UserMenu.addToDynamicPageTitle(this.base.getView(), this);
                    this._hideShellTitle();
                },
                routing: {
                    onAfterBinding: function () {
                        UserMenu.addToDynamicPageTitle(this.base.getView(), this);
                        this._hideShellTitle();
                    }
                }
            },

            onCreateUser: function () {
                var that = this;
                this._loadPermissions().then(function (aPermissions) {
                    that._openUserDialog(null, true, aPermissions);
                }).catch(function (oError) {
                    showError(oError, "Não foi possível carregar as permissões.");
                });
            },

            onEditUser: function (oEvent) {
                var that = this;
                var oContext = this._getSelectedContext(oEvent);
                var oUser = oContext && oContext.getObject();
                if (!oUser || !oUser.ID) {
                    MessageBox.warning("Selecione um usuário para editar.");
                    return;
                }

                Promise.all([
                    this._loadUser(oUser.ID),
                    this._loadPermissions()
                ]).then(function (aResults) {
                    that._openUserDialog(aResults[0], false, aResults[1]);
                }).catch(function (oError) {
                    showError(oError, "Não foi possível carregar o usuário.");
                });
            },

            onResetPassword: function (oEvent) {
                var oContext = this._getSelectedContext(oEvent);
                var oUser = oContext && oContext.getObject();
                if (!oUser || !oUser.ID) {
                    MessageBox.warning("Selecione um usuário para redefinir a senha.");
                    return;
                }
                this._openPasswordDialog(oUser.ID, oUser.username);
            },

            _loadPermissions: function () {
                return adminFetch("/odata/v4/admin/Permissions?$orderby=name&$top=100")
                    .then(function (oData) { return oData.value || []; });
            },

            _loadUser: function (sUserId) {
                return adminFetch("/odata/v4/admin/Users(" + sUserId + ")?$expand=permissions($expand=permission)");
            },

            _openUserDialog: function (oUser, bCreate, aAllPerms) {
                var that = this;
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

                var aInputs = [oFirstName, oLastName, oUsername];
                if (bCreate) {
                    aInputs.push(oPassword, oConfirm);
                }

                var oDialog = new Dialog({
                    title: sTitle,
                    contentWidth: "30rem",
                    verticalScrolling: true,
                    content: new VBox({
                        width: "100%",
                        renderType: "Bare",
                        items: aItems
                    }).addStyleClass("sapUiSmallMargin"),
                    beginButton: new Button({
                        text: bCreate ? "Criar" : "Salvar",
                        type: "Emphasized",
                        press: function () {
                            that._handleSave(oUser, bCreate, {
                                active: oActiveSwitch.getState(),
                                firstName: oFirstName.getValue().trim(),
                                lastName: oLastName.getValue().trim(),
                                username: oUsername.getValue().trim(),
                                password: oPassword ? oPassword.getValue() : null,
                                confirm: oConfirm ? oConfirm.getValue() : null,
                                checkBoxes: aCheckBoxes
                            }, oDialog, aInputs);
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

            _handleSave: function (oUser, bCreate, oData, oDialog, aInputs) {
                var that = this;

                aInputs.forEach(function (oInput) {
                    oInput.setValueState("None");
                });

                if (!this._validateUserForm(bCreate, oData, aInputs)) {
                    return;
                }

                oDialog.setBusy(true);

                var pSave = bCreate
                    ? this._createUser(oData)
                    : this._updateUser(oUser, oData);

                pSave.then(function () {
                    MessageToast.show(bCreate ? "Usuário criado com sucesso." : "Usuário atualizado.");
                    oDialog.close();
                    that._refreshList();
                }).catch(function (oError) {
                    oDialog.setBusy(false);
                    showError(oError, bCreate ? "Não foi possível criar o usuário." : "Não foi possível salvar as alterações.");
                });
            },

            _validateUserForm: function (bCreate, oData, aInputs) {
                var bValid = true;

                if (!oData.firstName) {
                    aInputs[0].setValueState("Error");
                    aInputs[0].setValueStateText("Nome é obrigatório.");
                    bValid = false;
                }
                if (!oData.lastName) {
                    aInputs[1].setValueState("Error");
                    aInputs[1].setValueStateText("Sobrenome é obrigatório.");
                    bValid = false;
                }

                if (bCreate) {
                    if (!oData.username || !/^[a-zA-Z0-9._-]{3,12}$/.test(oData.username)) {
                        aInputs[2].setValueState("Error");
                        aInputs[2].setValueStateText("Username: 3-12 caracteres (letras, números, ., _, -).");
                        bValid = false;
                    }
                    if (!oData.password || oData.password.length < 8) {
                        aInputs[3].setValueState("Error");
                        aInputs[3].setValueStateText("Mínimo 8 caracteres.");
                        bValid = false;
                    } else if (oData.password !== oData.confirm) {
                        aInputs[4].setValueState("Error");
                        aInputs[4].setValueStateText("As senhas não coincidem.");
                        bValid = false;
                    }
                }

                return bValid;
            },

            _createUser: function (oData) {
                var aPermIds = oData.checkBoxes
                    .filter(function (oCheckBox) { return oCheckBox.getSelected(); })
                    .map(function (oCheckBox) { return oCheckBox.data("permId"); });

                return adminFetch("/odata/v4/admin/createUser", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        username: oData.username,
                        firstName: oData.firstName,
                        lastName: oData.lastName,
                        password: oData.password,
                        active: oData.active,
                        permissions: aPermIds
                    })
                });
            },

            _updateUser: function (oUser, oData) {
                var aSteps = [
                    adminFetch("/odata/v4/admin/Users(" + oUser.ID + ")", {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ firstName: oData.firstName, lastName: oData.lastName })
                    })
                ];

                if (!!oData.active !== !!oUser.active) {
                    aSteps.push(adminFetch(
                        "/odata/v4/admin/Users(" + oUser.ID + ")/AdminService.toggleActive",
                        { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }
                    ));
                }

                var oOldPermIds = {};
                (oUser.permissions || []).forEach(function (p) {
                    oOldPermIds[p.permission_ID] = true;
                });

                oData.checkBoxes.forEach(function (oCheckBox) {
                    var sPermId = oCheckBox.data("permId");
                    var bChecked = oCheckBox.getSelected();
                    var bHad = !!oOldPermIds[sPermId];

                    if (bChecked && !bHad) {
                        aSteps.push(adminFetch(
                            "/odata/v4/admin/Users(" + oUser.ID + ")/AdminService.assignPermission",
                            { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ permissionId: sPermId }) }
                        ));
                    } else if (!bChecked && bHad) {
                        aSteps.push(adminFetch(
                            "/odata/v4/admin/Users(" + oUser.ID + ")/AdminService.revokePermission",
                            { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ permissionId: sPermId }) }
                        ));
                    }
                });

                return Promise.all(aSteps);
            },

            _openPasswordDialog: function (sUserId, sUsername) {
                var oNewPass = new Input({ type: "Password", width: "100%" });
                var oConfirm = new Input({ type: "Password", width: "100%" });

                var oDialog = new Dialog({
                    title: "Redefinir Senha: " + sUsername,
                    contentWidth: "26rem",
                    content: new VBox({
                        width: "100%",
                        renderType: "Bare",
                        items: [
                            new Label({ text: "Nova Senha", required: true }),
                            oNewPass,
                            new Label({ text: "Confirmar Senha", required: true }),
                            oConfirm,
                            new Text({ text: "Mínimo 8 caracteres." }).addStyleClass("sapUiTinyMarginTop")
                        ]
                    }).addStyleClass("sapUiSmallMargin"),
                    beginButton: new Button({
                        text: "Confirmar",
                        type: "Emphasized",
                        press: function () {
                            oNewPass.setValueState("None");
                            oConfirm.setValueState("None");

                            var sNew = oNewPass.getValue();
                            var sCfm = oConfirm.getValue();
                            var bValid = true;

                            if (!sNew || sNew.length < 8) {
                                oNewPass.setValueState("Error");
                                oNewPass.setValueStateText("Mínimo 8 caracteres.");
                                bValid = false;
                            }
                            if (sNew !== sCfm) {
                                oConfirm.setValueState("Error");
                                oConfirm.setValueStateText("As senhas não coincidem.");
                                bValid = false;
                            }
                            if (!bValid) return;

                            oDialog.setBusy(true);
                            adminFetch(
                                "/odata/v4/admin/Users(" + sUserId + ")/AdminService.resetPassword",
                                { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ newPassword: sNew }) }
                            ).then(function () {
                                MessageToast.show("Senha redefinida com sucesso.");
                                oDialog.close();
                            }).catch(function (oError) {
                                oDialog.setBusy(false);
                                showError(oError, "Não foi possível redefinir a senha.");
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

            _refreshList: function () {
                var oModel = this.base.getView().getModel();
                if (oModel && oModel.refresh) {
                    oModel.refresh();
                }
            },

            _getSelectedContext: function (oEvent) {
                var aContexts = oEvent && oEvent.getParameter && oEvent.getParameter("contexts");
                if (aContexts && aContexts.length) {
                    return aContexts[0];
                }
                return null;
            },

            _addNavBackButton: function () {
                var oView = this.base.getView();
                var oDynamicPage = this._findDynamicPage(oView);
                if (!oDynamicPage) return;

                var oTitle = oDynamicPage.getTitle();
                if (!oTitle) return;

                var bAlreadyAdded = (oTitle.getActions() || [])
                    .some(function (oButton) { return oButton.data("navBack") === true; });
                if (bAlreadyAdded) return;

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

            _getAppRouter: function () {
                var oComp = this.base.getOwnerComponent();
                var oRouter;
                while (oComp) {
                    oRouter = oComp.getRouter && oComp.getRouter();
                    if (oRouter) return oRouter;
                    var oParent = sap.ui.core.Component.getOwnerComponentFor(oComp);
                    if (!oParent || oParent === oComp) break;
                    oComp = oParent;
                }
                return null;
            },

            _hideShellTitle: function () {
                var oDynamicPage = this._findDynamicPage(this.base.getView());
                if (oDynamicPage) {
                    oDynamicPage.addStyleClass("lge-materials-page");
                }
            },

            _findDynamicPage: function (oControl) {
                if (!oControl) return null;
                if (oControl.isA && oControl.isA("sap.f.DynamicPage")) {
                    return oControl;
                }

                var aContent = (oControl.getContent && oControl.getContent()) || [];
                for (var i = 0; i < aContent.length; i++) {
                    var oFound = this._findDynamicPage(aContent[i]);
                    if (oFound) return oFound;
                }

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
