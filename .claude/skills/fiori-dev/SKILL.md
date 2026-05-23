---
name: fiori-dev
description: Develop SAP Fiori/UI5 applications following best practices: MVC architecture, OData binding, routing, i18n, and strict state management patterns. Use when working with SAP Fiori, SAPUI5, OpenUI5, freestyle apps, or Fiori Elements. Enforces prohibition of sessionStorage/localStorage in favor of UI5-native state management.
---

# SAP Fiori Development

## Quick start

```
webapp/
├── manifest.json        # App descriptor (routing, models, i18n)
├── Component.js         # App root component
├── controller/
├── view/                # XML Views only
├── model/               # JSONModel, ODataModel helpers
├── i18n/
│   └── i18n.properties
└── test/
```

## Core Rules

1. **XML Views only** — never create views programmatically via JS
2. **sessionStorage is FORBIDDEN** — see [State Management](#state-management)
3. **localStorage is FORBIDDEN** for app state — use models
4. Bind everything via data binding — avoid direct DOM manipulation
5. Use `i18n` model for all user-facing strings — no hardcoded text
6. Define all routes in `manifest.json`, never navigate with raw hashes

## State Management

### FORBIDDEN
```js
// NEVER do this
sessionStorage.setItem("userId", "123");
localStorage.setItem("filters", JSON.stringify(filters));
window.__myGlobal = data;
```

### CORRECT — JSONModel on Component
```js
// Component.js — single source of truth
init: function () {
    UIComponent.prototype.init.apply(this, arguments);
    this.setModel(new JSONModel({ userId: null, filters: {} }), "appState");
    this.getRouter().initialize();
},

// Any controller — read/write state
this.getOwnerComponent().getModel("appState").setProperty("/userId", "123");
var filters = this.getOwnerComponent().getModel("appState").getProperty("/filters");
```

### Passing data between views — routing with query params
```js
// Navigate with state
this.getOwnerComponent().getRouter().navTo("detail", {
    objectId: sId,
    "?query": { mode: "edit" }
});

// Receive in target controller
onRouteMatched: function (oEvent) {
    var oArgs = oEvent.getParameter("arguments");
    var sId = oArgs.objectId;
    var sMode = oArgs["?query"].mode;
}
```

## Workflows

### New freestyle app checklist
- [ ] `manifest.json` declares `sap.app`, `sap.ui5` (models, routing, dependencies)
- [ ] `Component.js` initializes models and router
- [ ] All OData calls via `v2.ODataModel` bound in manifest — not created in controllers
- [ ] Views use `{i18n>key}` for all labels
- [ ] No `sessionStorage`, `localStorage`, or global variables
- [ ] Error handling via `MessageBox`/`MessageToast`, not `alert()`

### OData read pattern
```js
var oModel = this.getView().getModel(); // bound in manifest
oModel.read("/EntitySet", {
    filters: [new Filter("Field", FilterOperator.EQ, sValue)],
    success: function (oData) { /* update JSONModel */ },
    error: function (oError) { MessageBox.error(oError.message); }
});
```

### i18n usage
```xml
<!-- view -->
<Button text="{i18n>saveButton}" />
```
```js
// controller
var sMsg = this.getView().getModel("i18n").getResourceBundle().getText("confirmMsg", [sName]);
```

## Advanced features

See [REFERENCE.md](REFERENCE.md) for:
- Full manifest.json template
- ODataModel v2/v4 patterns
- Fiori Elements (ListReport, ObjectPage)
- Testing with QUnit/OPA5
- Deployment via `ui5 build`

See [EXAMPLES.md](EXAMPLES.md) for complete working code samples.
