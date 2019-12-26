"use strict";

const fastifyPlugin = require("fastify-plugin");

async function hapiCompat(fastify) {
  fastify.decorateRequest("path", {
    getter() {
      return this.raw.url.match("^[^?]*")[0];
    }
  });
  fastify.decorateRequest("info", {
    getter() {
      return { remoteAddress: this.ip };
    }
  });
}

module.exports = fastifyPlugin(hapiCompat, {
  name: "hapi-compat"
});
