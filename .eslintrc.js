const { eslintRcTestTypeScript } = require("@xarc/module-dev");
module.exports = {
  extends: eslintRcTestTypeScript,
  rules: {
    // disable the rule for all files
    "@typescript-eslint/explicit-module-boundary-types": "off"
  }
};
