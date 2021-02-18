/* eslint-disable */

"use strict";
const fastifyPlugin = require("fastify-plugin");

async function es6StylePlugin(server) {
  server.decorate("es6StylePlugin", {});
}

module.exports.default = fastifyPlugin(es6StylePlugin, {
  name: "es6StylePlugin"
});
