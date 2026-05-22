sap.ui.define([
    "sap/ui/core/mvc/Controller"
], function (Controller) {
    "use strict";
    return Controller.extend("logestoque.login.Login", {
        onLogin: function () {
            var oView = this.getView();
            var sUsername = oView.byId("username").getValue();
            var sPassword = oView.byId("password").getValue();
            var oError = oView.byId("errorMessage");

            oError.setVisible(false);

            fetch("/auth/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username: sUsername, password: sPassword })
            })
            .then(async function (response) {
                if (!response.ok) {
                    const err = await response.json();
                    throw new Error(err.error || "Credenciais inválidas");
                }
                return response.json();
            })
            .then(function (data) {
                sessionStorage.setItem("token", data.token);
                window.location.href = "/";
            })
            .catch(function (err) {
                oError.setText(err.message);
                oError.setVisible(true);
            });
        }
    });
});
