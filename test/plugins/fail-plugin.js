"use strict";
const fastifyPlugin = require("fastify-plugin");

async function register() {
  throw new Error("fail-plugin");
}

module.exports = fastifyPlugin(register, {
  name: "fail-plugin"
});
