# Fiori Dev — Reference

## manifest.json full template

```json
{
  "_version": "1.58.0",
  "sap.app": {
    "id": "com.mycompany.myapp",
    "type": "application",
    "title": "{{appTitle}}",
    "description": "{{appDescription}}",
    "applicationVersion": { "version": "1.0.0" },
    "dataSources": {
      "mainService": {
        "uri": "/sap/opu/odata/sap/MY_SERVICE_SRV/",
        "type": "OData",
        "settings": { "odataVersion": "2.0" }
      }
    }
  },
  "sap.ui5": {
    "rootView": {
      "viewName": "com.mycompany.myapp.view.App",
      "type": "XML",
      "id": "app"
    },
    "dependencies": {
      "minUI5Version": "1.120.0",
      "libs": {
        "sap.ui.core": {},
        "sap.m": {},
        "sap.ui.layout": {}
      }
    },
    "models": {
      "": {
        "dataSource": "mainService",
        "preload": true,
        "settings": {
          "defaultBindingMode": "TwoWay",
          "useBatch": true
        }
      },
      "i18n": {
        "type": "sap.ui.model.resource.ResourceModel",
        "settings": {
          "bundleName": "com.mycompany.myapp.i18n.i18n",
          "supportedLocales": ["", "pt", "en"],
          "fallbackLocale": ""
        }
      }
    },
    "routing": {
      "config": {
        "routerClass": "sap.m.routing.Router",
        "type": "JSON",
        "viewType": "XML",
        "viewPath": "com.mycompany.myapp.view",
        "controlAggregation": "pages",
        "controlId": "app",
        "async": true
      },
      "routes": [
        {
          "name": "list",
          "pattern": "",
          "target": "list"
        },
        {
          "name": "detail",
          "pattern": "detail/{objectId}/:?query:",
          "target": "detail"
        }
      ],
      "targets": {
        "list": { "viewName": "List", "viewLevel": 1 },
        "detail": { "viewName": "Detail", "viewLevel": 2 }
      }
    }
  }
}
```

---

## State Management — Patterns in depth

### Why sessionStorage/localStorage are FORBIDDEN

| Problem | Detail |
|---|---|
| Not reactive | UI does not update automatically when value changes |
| Serialization errors | Objects must be manually JSON.stringify/parse — prone to bugs |
| Cross-tab contamination | State bleeds between browser tabs in the same origin |
| No cleanup lifecycle | Data persists after the user navigates away or closes the session |
| Breaks shell integration | SAP Fiori Launchpad manages the session; bypassing it causes conflicts |

### Approved state containers

| Scope | Mechanism |
|---|---|
| App-wide | `JSONModel` named `"appState"` on `Component` |
| View-local | `JSONModel` on the view (`this.getView().setModel(...)`) |
| Between routes | Router params / query params |
| Persistent user settings | `sap.ui.core.Personalization` / `sap.ushell.Container.getService("Personalization")` |
| Backend persistence | OData PATCH/POST |

### Component-level appState pattern (full)

```js
// Component.js
sap.ui.define([
    "sap/ui/core/UIComponent",
    "sap/ui/model/json/JSONModel"
], function (UIComponent, JSONModel) {
    "use strict";
    return UIComponent.extend("com.mycompany.myapp.Component", {
        metadata: { manifest: "json" },
        init: function () {
            UIComponent.prototype.init.apply(this, arguments);
            // Initialize centralized state — the only allowed cross-view store
            this.setModel(new JSONModel({
                currentUser: null,
                selectedFilters: {},
                busy: false
            }), "appState");
            this.getRouter().initialize();
        }
    });
});
```

```js
// BaseController.js — mixin for all controllers
sap.ui.define(["sap/ui/core/mvc/Controller"], function (Controller) {
    "use strict";
    return Controller.extend("com.mycompany.myapp.controller.BaseController", {
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

---

## ODataModel v2 patterns

### Batch + deferred groups

```js
// Defer writes to a named group, then submit all at once
oModel.setDeferredGroups(["myBatch"]);

oModel.create("/EntitySet", oPayload, { groupId: "myBatch" });
oModel.update("/EntitySet('key')", oChanges, { groupId: "myBatch" });

oModel.submitChanges({
    groupId: "myBatch",
    success: function () { MessageToast.show(sSuccessMsg); },
    error: function (oError) { MessageBox.error(oError.message); }
});
```

### Read with expands

```js
oModel.read("/SalesOrderSet('" + sId + "')", {
    urlParameters: { "$expand": "ToItems,ToPartner" },
    success: function (oData) {
        this.getView().getModel("viewData").setData(oData);
    }.bind(this),
    error: function (oError) { /* handle */ }
});
```

---

## ODataModel v4 patterns

```js
// manifest model: "apiVersion": "4.0"
var oBinding = this.getView().getModel().bindList("/EntitySet", null, [], [
    new Filter("Status", FilterOperator.EQ, "A")
], { $$groupId: "$auto" });

oBinding.requestContexts(0, 20).then(function (aContexts) {
    var aData = aContexts.map(function (oCtx) { return oCtx.getObject(); });
    this.getView().getModel("viewData").setProperty("/items", aData);
}.bind(this));
```

---

## Fiori Elements

### ListReport + ObjectPage (Annotations)
```xml
<!-- webapp/annotations/annotation.xml -->
<Annotations Target="MY_SERVICE.EntityType">
  <Annotation Term="UI.LineItem">
    <Collection>
      <Record Type="UI.DataField">
        <PropertyValue Property="Value" Path="Field1"/>
      </Record>
    </Collection>
  </Annotation>
  <Annotation Term="UI.SelectionFields">
    <Collection>
      <PropertyPath>Field1</PropertyPath>
    </Collection>
  </Annotation>
</Annotations>
```

manifest routing for Fiori Elements:
```json
"targets": {
  "list": {
    "type": "Component",
    "name": "sap.fe.templates.ListReport",
    "options": {
      "settings": {
        "entitySet": "EntitySet",
        "annotationPath": "com.sap.vocabularies.UI.v1.SelectionVariant#Default"
      }
    }
  }
}
```

---

## Testing

### QUnit — unit test for model logic
```js
QUnit.test("formatStatus returns correct label", function (assert) {
    var oFormatter = sap.ui.require("com/mycompany/myapp/model/formatter");
    assert.strictEqual(oFormatter.formatStatus("A"), "Active");
});
```

### OPA5 — integration test
```js
opaTest("Should navigate to detail", function (Given, When, Then) {
    Given.iStartMyApp();
    When.onTheListPage.iPressFirstItem();
    Then.onTheDetailPage.iShouldSeeTheTitle("Order 1000");
    Then.iTeardownMyApp();
});
```

---

## Build & Deploy

```bash
# Install UI5 tooling
npm install --save-dev @ui5/cli

# ui5.yaml minimal config
# specVersion: "3.0"
# metadata: { name: com.mycompany.myapp }
# type: application

npm run build            # → dist/ folder
npm run deploy           # via @sap/ux-ui5-tooling or fiori-tools
```
