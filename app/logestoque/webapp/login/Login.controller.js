sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/util/Storage"
], function (Controller, Storage) {
    "use strict";
    return Controller.extend("login.Login", {
        onLoginPress: function () {
            var oView = this.getView();
            var sUsername = oView.byId("usernameInput").getValue();
            var sPassword = oView.byId("passwordInput").getValue();
            var sError = oView.byId("errorText");

            fetch("/auth/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username: sUsername, password: sPassword })
            })
            .then(async function (response) {
                if (!response.ok) {
                    const err = await response.json();
                    throw new Error(err.error);
                }
                return response.json();
            })
            .then(function (data) {
                var oStorage = new Storage(Storage.Type.session);
                oStorage.put("token", data.token);
                sap.m.URLHelper.redirect("/", true);
            })
            .catch(function (err) {
                sError.setText(err.message);
                sError.setVisible(true);
            });
        }
    });
});
