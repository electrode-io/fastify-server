/* eslint-disable */

"use strict";
const fastifyPlugin = require("fastify-plugin");

//
// simple plugin to provide server.app.config in request.app.config
//

async function appConfigPlugin(server) {
  server.addHook("onRequest", async request => {
    request.app.config = server.app.config;
  });
}

module.exports = fastifyPlugin(appConfigPlugin, {
  name: "appConfig"
});
