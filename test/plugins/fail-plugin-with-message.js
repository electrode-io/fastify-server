"use strict";
const fastifyPlugin = require("fastify-plugin");

async function register() {
  throw new Error();
}

module.exports = fastifyPlugin(register, {
  name: "fail-plugin"
});
