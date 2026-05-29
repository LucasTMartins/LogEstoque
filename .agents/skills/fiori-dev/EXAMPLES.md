# Fiori Dev — Examples

## Complete List → Detail app

### Component.js
```js
sap.ui.define([
    "sap/ui/core/UIComponent",
    "sap/ui/model/json/JSONModel"
], function (UIComponent, JSONModel) {
    "use strict";

    return UIComponent.extend("com.mycompany.orders.Component", {
        metadata: { manifest: "json" },

        init: function () {
            UIComponent.prototype.init.apply(this, arguments);
            // Centralized app state — the ONLY cross-view state container allowed
            this.setModel(new JSONModel({
                selectedOrderId: null,
                filterValues: { status: "A", customer: "" },
                busy: false
            }), "appState");
            this.getRouter().initialize();
        }
    });
});
```

### controller/List.controller.js
```js
sap.ui.define([
    "./BaseController",
    "sap/ui/model/json/JSONModel",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/m/MessageBox"
], function (BaseController, JSONModel, Filter, FilterOperator, MessageBox) {
    "use strict";

    return BaseController.extend("com.mycompany.orders.controller.List", {

        onInit: function () {
            // View-local model — transient UI state, NOT sessionStorage
            this.getView().setModel(new JSONModel({ busy: false, items: [] }), "view");
            this._loadOrders();
        },

        _loadOrders: function () {
            var oModel = this.getView().getModel();
            var oFilters = this.getAppState("/filterValues");

            this.getView().getModel("view").setProperty("/busy", true);

            oModel.read("/SalesOrderSet", {
                filters: [
                    new Filter("Status", FilterOperator.EQ, oFilters.status)
                ],
                success: function (oData) {
                    this.getView().getModel("view").setProperty("/items", oData.results);
                    this.getView().getModel("view").setProperty("/busy", false);
                }.bind(this),
                error: function (oError) {
                    this.getView().getModel("view").setProperty("/busy", false);
                    MessageBox.error(oError.message);
                }.bind(this)
            });
        },

        onItemPress: function (oEvent) {
            var sOrderId = oEvent.getSource().getBindingContext().getProperty("SalesOrderId");
            // Store selection in appState model — NOT sessionStorage
            this.setAppState("/selectedOrderId", sOrderId);
            // Navigate via router with the ID in the URL
            this.getRouter().navTo("detail", { objectId: sOrderId });
        }
    });
});
```

### controller/Detail.controller.js
```js
sap.ui.define([
    "./BaseController",
    "sap/m/MessageBox",
    "sap/m/MessageToast"
], function (BaseController, MessageBox, MessageToast) {
    "use strict";

    return BaseController.extend("com.mycompany.orders.controller.Detail", {

        onInit: function () {
            this.getRouter().getRoute("detail").attachPatternMatched(this._onRouteMatched, this);
        },

        _onRouteMatched: function (oEvent) {
            // Read state from route params — not from sessionStorage
            var sOrderId = oEvent.getParameter("arguments").objectId;
            this.getView().bindElement({
                path: "/SalesOrderSet('" + sOrderId + "')",
                parameters: { expand: "ToItems" },
                events: {
                    dataRequested: function () { this.getView().setBusy(true); }.bind(this),
                    dataReceived: function () { this.getView().setBusy(false); }.bind(this)
                }
            });
        },

        onSave: function () {
            var oModel = this.getView().getModel();
            oModel.submitChanges({
                success: function () {
                    var sMsg = this.getResourceBundle().getText("saveSuccess");
                    MessageToast.show(sMsg);
                }.bind(this),
                error: function (oError) {
                    MessageBox.error(oError.message);
                }
            });
        },

        onNavBack: function () {
            this.getRouter().navTo("list", {}, true /*replace history*/);
        }
    });
});
```

### controller/BaseController.js
```js
sap.ui.define(["sap/ui/core/mvc/Controller"], function (Controller) {
    "use strict";

    return Controller.extend("com.mycompany.orders.controller.BaseController", {

        getRouter: function () {
            return this.getOwnerComponent().getRouter();
        },

        getResourceBundle: function () {
            return this.getView().getModel("i18n").getResourceBundle();
        },

        // Centralized appState accessors — replaces any sessionStorage usage
        getAppStateModel: function () {
            return this.getOwnerComponent().getModel("appState");
        },

        getAppState: function (sPath) {
            return this.getAppStateModel().getProperty(sPath);
        },

        setAppState: function (sPath, vValue) {
            this.getAppStateModel().setProperty(sPath, vValue);
        }
    });
});
```

### view/List.view.xml
```xml
<mvc:View
    controllerName="com.mycompany.orders.controller.List"
    xmlns:mvc="sap.ui.core.mvc"
    xmlns="sap.m"
    displayBlock="true">
    <Page title="{i18n>listTitle}" busy="{view>/busy}">
        <content>
            <List
                items="{view>/items}"
                mode="SingleSelectMaster"
                itemPress=".onItemPress">
                <StandardListItem
                    title="{view>SalesOrderId}"
                    description="{view>CustomerName}"
                    info="{view>Status}" />
            </List>
        </content>
    </Page>
</mvc:View>
```

### i18n/i18n.properties
```properties
appTitle=My Orders App
listTitle=Sales Orders
detailTitle=Order Detail
saveButton=Save
saveSuccess=Order saved successfully
confirmDeleteMsg=Delete order {0}?
```

---

## Anti-pattern vs correct pattern side-by-side

### Passing filter state to next view

**WRONG — sessionStorage**
```js
// List controller
sessionStorage.setItem("activeFilter", JSON.stringify(this._oFilterBar.getFilterGroupItems()));

// Detail controller — fragile, not reactive, pollutes browser storage
var oFilter = JSON.parse(sessionStorage.getItem("activeFilter"));
```

**CORRECT — appState JSONModel**
```js
// List controller
this.setAppState("/selectedFilters", {
    status: sStatus,
    dateFrom: oDateFrom,
    dateTo: oDateTo
});

// Detail controller — reactive, typed, cleaned up with component lifecycle
var oFilters = this.getAppState("/selectedFilters");
```

### Storing user context

**WRONG**
```js
sessionStorage.setItem("loggedUser", sUserId);
// later...
var sUser = sessionStorage.getItem("loggedUser"); // may be null, stale, or from another tab
```

**CORRECT — fetch once, store in appState**
```js
// Component.js init
sap.ushell.Container.getService("UserInfo").getId().then(function (sUserId) {
    this.getModel("appState").setProperty("/currentUser", sUserId);
}.bind(this));

// Any controller
var sUser = this.getAppState("/currentUser");
```
