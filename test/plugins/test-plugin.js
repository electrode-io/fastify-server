/* eslint-disable */

"use strict";
const fastifyPlugin = require("fastify-plugin");

async function testPlugin(server) {
  server.decorate("testPlugin", {});
}

module.exports = fastifyPlugin(testPlugin, {
  name: "testPlugin"
});
