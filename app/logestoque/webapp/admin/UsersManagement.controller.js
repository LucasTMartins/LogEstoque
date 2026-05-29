sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/ui/core/CustomData",
    "sap/m/Dialog",
    "sap/m/Button",
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
    Controller,
    JSONModel,
    CustomData,
    Dialog,
    Button,
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

    // ── Helpers de erro (mesmo padrão de CustomActions.js) ───────────────────

    function parseJson(v) {
        if (typeof v !== "string") return v;
        try { return JSON.parse(v); } catch { return null; }
    }

    function normalizeMessage(v) {
        if (!v) return "";
        if (typeof v === "string") return v;
        return v.value || v.message || "";
    }

    function collectMessages(aOut, vMessages) {
        if (!vMessages) return;
        if (!Array.isArray(vMessages)) { collectMessages(aOut, [vMessages]); return; }
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
                var ct = r.headers.get("content-type") || "";
                return ct.indexOf("json") !== -1 ? r.json() : true;
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

    // ── Controller ─────────────────────────────────────────────────────────────

    return Controller.extend("br.dev.imlucas.logestoque.admin.UsersManagement", {

        onInit: function () {
            var that = this;

            // Modelo local: /users (todos), /displayUsers (filtrados), /allPermissions
            var oModel = new JSONModel({ users: [], displayUsers: [], allPermissions: [] });
            this.getView().setModel(oModel, "usersModel");

            // Guard: verifica acesso ao AdminService diretamente — o backend é a autoridade final
            fetch("/odata/v4/admin/Users?$top=0&$select=ID", { credentials: "include" })
                .then(function (r) {
                    if (r.status !== 200) {
                        that._navToHome();
                        return;
                    }
                    that._loadData();
                })
                .catch(function () {
                    that._navToHome();
                });
        },

        onNavBack: function () {
            this._navToHome();
        },

        onUserMenuPress: function (oEvent) {
            UserMenu.open(this, oEvent.getSource());
        },

        _navToHome: function () {
            var oRouter = this.getOwnerComponent ? this.getOwnerComponent().getRouter() : null;
            if (oRouter) oRouter.navTo("MovimentsList");
        },

        // ── Carrega usuários e permissões disponíveis ────────────────────────

        _loadData: function () {
            var that = this;
            var oModel = this.getView().getModel("usersModel");

            Promise.all([
                adminFetch("/odata/v4/admin/Users?$expand=permissions($expand=permission)&$orderby=username&$top=200"),
                adminFetch("/odata/v4/admin/Permissions?$orderby=name&$top=100")
            ]).then(function (aResults) {
                var aUsers = (aResults[0].value || []).map(function (u) {
                    return Object.assign({}, u, {
                        permissionsLabel: that._buildPermLabel(u.permissions)
                    });
                });
                oModel.setProperty("/users", aUsers);
                oModel.setProperty("/allPermissions", aResults[1].value || []);
                that._applyFilters();
            }).catch(function (oError) {
                showError(oError, "Não foi possível carregar os usuários.");
            });
        },

        _buildPermLabel: function (aPerms) {
            if (!aPerms || !aPerms.length) return "—";
            return aPerms
                .map(function (p) { return p.permission ? p.permission.name : (p.permission_name || ""); })
                .filter(Boolean)
                .join(", ");
        },

        // ── Filtros (atualiza /displayUsers sem rebinding) ───────────────────

        onSearch: function () {
            this._applyFilters();
        },

        onStatusFilter: function () {
            this._applyFilters();
        },

        _applyFilters: function () {
            var oModel    = this.getView().getModel("usersModel");
            var aAllUsers = oModel.getProperty("/users") || [];
            var sSearch   = (this.byId("searchField").getValue() || "").trim().toLowerCase();
            var sStatus   = this.byId("statusFilter").getSelectedKey();

            var aFiltered = aAllUsers.filter(function (u) {
                var bStatusOk = sStatus === ""
                    || (sStatus === "true"  &&  u.active)
                    || (sStatus === "false" && !u.active);

                var bSearchOk = !sSearch
                    || (u.username || "").toLowerCase().indexOf(sSearch) !== -1
                    || ((u.firstName || "") + " " + (u.lastName || "")).toLowerCase().indexOf(sSearch) !== -1;

                return bStatusOk && bSearchOk;
            });

            oModel.setProperty("/displayUsers", aFiltered);
        },

        // ── Ações do toolbar ─────────────────────────────────────────────────

        onNewUser: function () {
            this._openUserDialog(null, true);
        },

        onEditUser: function (oEvent) {
            var oCtx  = oEvent.getSource().getBindingContext("usersModel");
            var oUser = oCtx ? oCtx.getObject() : null;
            if (oUser) this._openUserDialog(oUser, false);
        },

        // ── Dialog de criação / edição ────────────────────────────────────────

        _openUserDialog: function (oUser, bCreate) {
            var that  = this;
            var oModel = this.getView().getModel("usersModel");
            var aAllPerms = oModel.getProperty("/allPermissions") || [];
            var sTitle = bCreate ? "Novo Usuário" : "Editar Usuário: " + (oUser && oUser.username);

            var oActiveSwitch = new Switch({ state: bCreate ? true : !!(oUser && oUser.active) });
            var oFirstName    = new Input({ value: bCreate ? "" : (oUser && oUser.firstName) || "", width: "100%" });
            var oLastName     = new Input({ value: bCreate ? "" : (oUser && oUser.lastName)  || "", width: "100%" });
            var oUsername     = new Input({ value: bCreate ? "" : (oUser && oUser.username)  || "", editable: !!bCreate, width: "100%" });
            var oPassword     = bCreate ? new Input({ type: "Password", width: "100%" }) : null;
            var oConfirm      = bCreate ? new Input({ type: "Password", width: "100%" }) : null;

            // IDs das permissões que o usuário já possui
            var oUserPermIds = {};
            if (oUser && oUser.permissions) {
                oUser.permissions.forEach(function (p) { oUserPermIds[p.permission_ID] = true; });
            }

            var aCheckBoxes = aAllPerms.map(function (perm) {
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
            aCheckBoxes.forEach(function (cb) { aItems.push(cb); });

            // Inputs validáveis (ordem importa para mensagens de erro)
            var aInputs = [oFirstName, oLastName, oUsername];
            if (bCreate) { aInputs.push(oPassword, oConfirm); }

            var aButtons = [];

            if (!bCreate) {
                aButtons.push(new Button({
                    text: "Redefinir Senha",
                    press: function () {
                        oDialog.close();
                        that._openPasswordDialog(oUser.ID, oUser.username);
                    }
                }));
            }

            aButtons.push(new Button({
                text: "Cancelar",
                press: function () { oDialog.close(); }
            }));

            aButtons.push(new Button({
                text: bCreate ? "Criar" : "Salvar",
                type: "Emphasized",
                press: function () {
                    that._handleSave(oUser, bCreate, {
                        active:     oActiveSwitch.getState(),
                        firstName:  oFirstName.getValue().trim(),
                        lastName:   oLastName.getValue().trim(),
                        username:   oUsername.getValue().trim(),
                        password:   oPassword ? oPassword.getValue()  : null,
                        confirm:    oConfirm  ? oConfirm.getValue()   : null,
                        checkBoxes: aCheckBoxes,
                        allPerms:   aAllPerms
                    }, oDialog, aInputs);
                }
            }));

            var oDialog = new Dialog({
                title: sTitle,
                contentWidth: "30rem",
                verticalScrolling: true,
                content: new VBox({
                    width: "100%",
                    renderType: "Bare",
                    items: aItems
                }).addStyleClass("sapUiSmallMargin"),
                buttons: aButtons,
                afterClose: function () { oDialog.destroy(); }
            });

            oDialog.open();
        },

        _handleSave: function (oUser, bCreate, oData, oDialog, aInputs) {
            var that = this;

            aInputs.forEach(function (i) { i.setValueState("None"); });

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
                    aInputs[2].setValueStateText("Username: 3–12 caracteres (letras, números, ., _, -).");
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

            if (!bValid) return;

            oDialog.setBusy(true);

            var pMain;

            if (bCreate) {
                var aPermIds = oData.checkBoxes
                    .filter(function (cb) { return cb.getSelected(); })
                    .map(function (cb) { return cb.data("permId"); });

                pMain = adminFetch("/odata/v4/admin/createUser", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        username:    oData.username,
                        firstName:   oData.firstName,
                        lastName:    oData.lastName,
                        password:    oData.password,
                        active:      oData.active,
                        permissions: aPermIds
                    })
                });
            } else {
                var aSteps = [];

                // Patch campos editáveis
                aSteps.push(adminFetch("/odata/v4/admin/Users(" + oUser.ID + ")", {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ firstName: oData.firstName, lastName: oData.lastName })
                }));

                // toggleActive somente se o estado mudou
                if (!!oData.active !== !!oUser.active) {
                    aSteps.push(adminFetch(
                        "/odata/v4/admin/Users(" + oUser.ID + ")/AdminService.toggleActive",
                        { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }
                    ));
                }

                // Delta de permissões
                var oOldPermIds = {};
                (oUser.permissions || []).forEach(function (p) { oOldPermIds[p.permission_ID] = true; });

                oData.checkBoxes.forEach(function (cb) {
                    var sPermId  = cb.data("permId");
                    var bChecked = cb.getSelected();
                    var bHad     = !!oOldPermIds[sPermId];

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

                pMain = Promise.all(aSteps);
            }

            pMain.then(function () {
                MessageToast.show(bCreate ? "Usuário criado com sucesso." : "Usuário atualizado.");
                oDialog.close();
                that._loadData();
            }).catch(function (oError) {
                oDialog.setBusy(false);
                showError(oError, bCreate ? "Não foi possível criar o usuário." : "Não foi possível salvar as alterações.");
            });
        },

        // ── Dialog de redefinição de senha ───────────────────────────────────

        _openPasswordDialog: function (sUserId, sUsername) {
            var oNewPass  = new Input({ type: "Password", width: "100%" });
            var oConfirm  = new Input({ type: "Password", width: "100%" });

            var oDialog = new Dialog({
                title: "Redefinir Senha — " + sUsername,
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

                        var sNew  = oNewPass.getValue();
                        var sCfm  = oConfirm.getValue();
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
        }
    });
});
