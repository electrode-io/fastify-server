"use strict";
const fastifyPlugin = require("fastify-plugin");

async function pluginNoPriority(server) {
  if (!server.app.plugin2) throw new Error("pluginNoPriority is called before plugin2");
}

async function nulPlugin1(server) {
  server.app.plugin1 = true;
}

async function nulPlugin2(server) {
  server.app.plugin2 = true;
  if (!server.app.plugin1) throw new Error("plugin2 is called before plugin1");
}

module.exports = {
  pageTitle: "test 1",
  plugins: {
    testNoPriority: {
      register: fastifyPlugin(pluginNoPriority, {
        name: "pluginNoPriority"
      })
    },
    plugin1: {
      register: fastifyPlugin(nulPlugin1, {
        name: "nulPlugin1"
      }),
      priority: 499
    },
    plugin1Disable: {
      register: fastifyPlugin(nulPlugin1, {
        name: "nulPlugin1"
      }),
      priority: 499,
      enable: false
    },
    testStringPriority: {
      register: fastifyPlugin(nulPlugin2, {
        name: "nulPlugin2"
      }),
      priority: "500"
    },
    testPlugin: {
      module: "./test/plugins/test-plugin"
    },
    es6StylePlugin: {
      module: "./test/plugins/es6-style-plugin"
    }
  },
  server: {
    app: {
      config: {
        test1: true
      }
    }
  }
};
