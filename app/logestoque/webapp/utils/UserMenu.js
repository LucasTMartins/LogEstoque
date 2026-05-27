sap.ui.define([
    "sap/ui/core/Component",
    "sap/m/ActionSheet",
    "sap/m/Button",
    "sap/m/Dialog",
    "sap/m/Input",
    "sap/m/Label",
    "sap/m/List",
    "sap/m/MessageBox",
    "sap/m/MessageToast",
    "sap/m/StandardListItem",
    "sap/m/Text",
    "sap/m/VBox"
// eslint-disable-next-line max-params
], function (
    Component,
    ActionSheet,
    Button,
    Dialog,
    Input,
    Label,
    List,
    MessageBox,
    MessageToast,
    StandardListItem,
    Text,
    VBox
) {
    "use strict";

    function getText(oContext, sKey, aArgs) {
        var oBundle = getOwnerComponent(oContext)?.getModel("i18n")?.getResourceBundle();
        return oBundle ? oBundle.getText(sKey, aArgs) : sKey;
    }

    function getToken() {
        return sessionStorage.getItem("token");
    }

    function getAuthHeaders(oHeaders) {
        var sToken = getToken();
        return Object.assign(
            sToken ? { Authorization: "Bearer " + sToken } : {},
            oHeaders || {}
        );
    }

    function serviceFetch(sUrl, oOptions) {
        return fetch(sUrl, Object.assign({ credentials: "include" }, oOptions, {
            headers: getAuthHeaders(oOptions && oOptions.headers)
        })).then(function (oResponse) {
            if (!oResponse.ok) {
                return oResponse.json().then(function (oJson) {
                    var oErr = new Error(String(oResponse.status));
                    oErr.status = oResponse.status;
                    oErr.responseText = JSON.stringify(oJson);
                    throw oErr;
                }).catch(function (oError) {
                    if (oError.status) { throw oError; }
                    var oErr = new Error(String(oResponse.status));
                    oErr.status = oResponse.status;
                    throw oErr;
                });
            }

            if (oResponse.status === 204) {
                return true;
            }

            var sContentType = oResponse.headers.get("content-type") || "";
            return sContentType.indexOf("json") !== -1 ? oResponse.json() : true;
        });
    }

    function parseJson(vValue) {
        if (typeof vValue !== "string") { return vValue; }
        try { return JSON.parse(vValue); } catch (_e) { return null; }
    }

    function getBackendMessage(oError) {
        var oPayload = parseJson(oError && oError.responseText) || oError;
        var oBackendError = oPayload && (oPayload.error || oPayload);
        var vMessage = oBackendError && oBackendError.message;

        if (typeof vMessage === "string") {
            return vMessage;
        }

        return vMessage && (vMessage.value || vMessage.message) || "";
    }

    function getOwnerComponent(oContext) {
        var oComponent = oContext && oContext.getOwnerComponent && oContext.getOwnerComponent();

        if (!oComponent && oContext && oContext.base && oContext.base.getOwnerComponent) {
            oComponent = oContext.base.getOwnerComponent();
        }

        while (oComponent) {
            if (oComponent.getModel && oComponent.getModel("currentUser")) {
                return oComponent;
            }

            var oParent = Component.getOwnerComponentFor(oComponent);
            if (!oParent || oParent === oComponent) { break; }
            oComponent = oParent;
        }

        return oComponent;
    }

    function getCurrentUser(oContext) {
        var oModel = getOwnerComponent(oContext)?.getModel("currentUser");
        return oModel ? oModel.getData() : {};
    }

    function findDynamicPage(oControl) {
        if (!oControl) { return null; }

        if (oControl.isA && oControl.isA("sap.f.DynamicPage")) {
            return oControl;
        }

        var aContent = (oControl.getContent && oControl.getContent()) || [];
        for (var i = 0; i < aContent.length; i++) {
            var oFound = findDynamicPage(aContent[i]);
            if (oFound) { return oFound; }
        }

        var oDom = oControl.getDomRef && oControl.getDomRef();
        if (oDom) {
            var oDynamicPageElement = oDom.querySelector(".sapFDynamicPage");
            return oDynamicPageElement && oDynamicPageElement.id
                ? sap.ui.getCore().byId(oDynamicPageElement.id)
                : null;
        }

        return null;
    }

    function createUserButton(oContext) {
        var oButton = new Button({
            icon: "sap-icon://customer",
            type: "Transparent",
            tooltip: "{i18n>userMenu_tooltip}",
            press: function (oEvent) {
                open(oContext, oEvent.getSource());
            }
        }).data("userMenu", true);

        oButton.bindProperty("text", {
            path: "currentUser>/username",
            formatter: function (sUsername) {
                return sUsername || getText(oContext, "userMenu_tooltip");
            }
        });

        return oButton;
    }

    function addToDynamicPageTitle(oView, oContext) {
        var oDynamicPage = findDynamicPage(oView);
        if (!oDynamicPage) { return; }

        var oTitle = oDynamicPage.getTitle && oDynamicPage.getTitle();
        if (!oTitle || !oTitle.getActions || !oTitle.insertAction) { return; }

        var bAlreadyAdded = oTitle.getActions().some(function (oAction) {
            return oAction.data("userMenu") === true;
        });
        if (bAlreadyAdded) { return; }

        oTitle.addAction(createUserButton(oContext));
    }

    function open(oContext, oSource) {
        var oUser = getCurrentUser(oContext);
        var oActionSheet = new ActionSheet({
            title: oUser.fullName || oUser.username || getText(oContext, "userMenu_title"),
            buttons: [
                new Button({
                    icon: "sap-icon://hint",
                    text: getText(oContext, "userMenu_permissions"),
                    press: function () {
                        showPermissions(oContext);
                    }
                }),
                new Button({
                    icon: "sap-icon://key",
                    text: getText(oContext, "userMenu_changePassword"),
                    press: function () {
                        showChangePassword(oContext);
                    }
                }),
                new Button({
                    icon: "sap-icon://log",
                    text: getText(oContext, "userMenu_logout"),
                    type: "Reject",
                    press: function () {
                        logout();
                    }
                })
            ],
            afterClose: function () {
                oActionSheet.destroy();
            }
        });

        oActionSheet.openBy(oSource);
    }

    function showPermissions(oContext) {
        var oList = new List({
            noDataText: getText(oContext, "userMenu_noPermissions")
        });
        var oDialog = new Dialog({
            title: getText(oContext, "userMenu_permissionsTitle"),
            contentWidth: "28rem",
            content: oList,
            endButton: new Button({
                text: getText(oContext, "userMenu_close"),
                press: function () {
                    oDialog.close();
                }
            }),
            afterClose: function () {
                oDialog.destroy();
            }
        });

        serviceFetch("/odata/v4/main/CurrentUserPermissions?$orderby=name")
            .then(function (oData) {
                (oData.value || []).forEach(function (oPermission) {
                    oList.addItem(new StandardListItem({
                        title: oPermission.name,
                        description: oPermission.description
                    }));
                });
            })
            .catch(function (oError) {
                MessageBox.error(getBackendMessage(oError) || getText(oContext, "userMenu_permissionsError"));
            });

        oDialog.open();
    }

    function showChangePassword(oContext) {
        var oCurrentPassword = new Input({
            type: "Password",
            width: "100%"
        });
        var oNewPassword = new Input({
            type: "Password",
            width: "100%"
        });
        var oConfirmPassword = new Input({
            type: "Password",
            width: "100%"
        });

        var oDialog = new Dialog({
            title: getText(oContext, "userMenu_changePasswordTitle"),
            contentWidth: "28rem",
            horizontalScrolling: false,
            content: new VBox({
                width: "100%",
                renderType: "Bare",
                items: [
                    new Label({ text: getText(oContext, "userMenu_currentPassword"), required: true }),
                    oCurrentPassword,
                    new Label({ text: getText(oContext, "userMenu_newPassword"), required: true }),
                    oNewPassword,
                    new Label({ text: getText(oContext, "userMenu_confirmPassword"), required: true }),
                    oConfirmPassword,
                    new Text({ text: getText(oContext, "userMenu_passwordHint") })
                ]
            }).addStyleClass("sapUiSmallMarginTopBottom"),
            beginButton: new Button({
                text: getText(oContext, "userMenu_savePassword"),
                type: "Emphasized",
                press: function () {
                    submitPasswordChange(oContext, oDialog, oCurrentPassword, oNewPassword, oConfirmPassword);
                }
            }),
            endButton: new Button({
                text: getText(oContext, "userMenu_cancel"),
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

    function resetValueStates(aInputs) {
        aInputs.forEach(function (oInput) {
            oInput.setValueState("None");
            oInput.setValueStateText("");
        });
    }

    function submitPasswordChange(oContext, oDialog, oCurrentPassword, oNewPassword, oConfirmPassword) {
        var sCurrentPassword = oCurrentPassword.getValue();
        var sNewPassword = oNewPassword.getValue();
        var sConfirmPassword = oConfirmPassword.getValue();
        var bValid = true;

        resetValueStates([oCurrentPassword, oNewPassword, oConfirmPassword]);

        if (!sCurrentPassword) {
            oCurrentPassword.setValueState("Error");
            oCurrentPassword.setValueStateText(getText(oContext, "userMenu_currentPasswordRequired"));
            bValid = false;
        }

        if (!sNewPassword || sNewPassword.length < 8) {
            oNewPassword.setValueState("Error");
            oNewPassword.setValueStateText(getText(oContext, "err_passwordTooShort"));
            bValid = false;
        }

        if (sNewPassword !== sConfirmPassword) {
            oConfirmPassword.setValueState("Error");
            oConfirmPassword.setValueStateText(getText(oContext, "err_passwordMismatch"));
            bValid = false;
        }

        if (!bValid) { return; }

        serviceFetch("/odata/v4/main/changeOwnPassword", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                currentPassword: sCurrentPassword,
                newPassword: sNewPassword
            })
        }).then(function () {
            MessageToast.show(getText(oContext, "userMenu_passwordChanged"));
            oDialog.close();
        }).catch(function (oError) {
            MessageBox.error(getBackendMessage(oError) || getText(oContext, "userMenu_passwordError"));
        });
    }

    function logout() {
        serviceFetch("/auth/logout", { method: "POST" }).finally(function () {
            sessionStorage.removeItem("token");
            window.location.replace("/login");
        });
    }

    return {
        addToDynamicPageTitle: addToDynamicPageTitle,
        createUserButton: createUserButton,
        open: open
    };
});
