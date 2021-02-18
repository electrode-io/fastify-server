/* eslint-disable */

"use strict";
const fastifyPlugin = require("fastify-plugin");

async function nulPlugin() {
  throw new Error("plugin_failure");
}

module.exports = {
  pageTitle: "test 1",
  electrode: {
    logLevel: "none"
  },
  plugins: {
    plugin1: {
      register: fastifyPlugin(nulPlugin, {
        name: "nulPlugin"
      })
    }
  },
  server: {
    app: {
      config: {
        test2: true
      }
    }
  }
};
