"use strict";

async function nulPlugin() {}

module.exports = {
  pageTitle: "test 1",
  plugins: {
    plugin1: {
      register: nulPlugin,
      name: "nulPlugin"
    },
    plugin2: {
      register: nulPlugin,
      name: "nulPlugin"
    }
  },
  server: {
    app: {
      config: {
        test2: true
      }
    }
  },
  electrode: {
    logLevel: "none"
  }
};
