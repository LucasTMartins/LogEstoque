sap.ui.define(["sap/ui/model/odata/v2/ODataModel"], function (ODataModel) {
  "use strict";

  var _token = null;

  function addTokenHeaders(mParameters, sToken) {
    var oParameters = Object.assign({}, mParameters || {});

    oParameters.headers = Object.assign({}, oParameters.headers || {});

    if (!oParameters.headers.Authorization) {
      oParameters.headers.Authorization = "Bearer " + sToken;
    }

    return oParameters;
  }

  var RequestInterceptor = {
    setToken: function (token) {
      _token = token;
    },

    attach: function () {
      var sToken = _token;

      if (!sToken) {
        return;
      }

      var proto = ODataModel.prototype;

      // read
      var fnRead = proto.read;
      proto.read = function (sPath, mParameters) {
        var oParameters = addTokenHeaders(mParameters, sToken);
        return fnRead.call(this, sPath, oParameters);
      };

      // create
      var fnCreate = proto.create;
      proto.create = function (sPath, oData, mParameters) {
        var oParameters = addTokenHeaders(mParameters, sToken);
        return fnCreate.call(this, sPath, oData, oParameters);
      };

      // update
      var fnUpdate = proto.update;
      proto.update = function (sPath, oData, mParameters) {
        var oParameters = addTokenHeaders(mParameters, sToken);
        return fnUpdate.call(this, sPath, oData, oParameters);
      };

      // remove
      var fnRemove = proto.remove;
      proto.remove = function (sPath, mParameters) {
        var oParameters = addTokenHeaders(mParameters, sToken);
        return fnRemove.call(this, sPath, oParameters);
      };
    }
  };

  return RequestInterceptor;
});
