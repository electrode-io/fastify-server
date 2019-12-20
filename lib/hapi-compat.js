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
  fastify.setErrorHandler((error, request, reply) => {
    if (error.isBoom) {
      reply
        .code(error.output.statusCode)
        .type("application/json")
        .headers(error.output.headers)
        .send(error.output.payload);
      return;
    }

    reply.send(error);
  });
}

module.exports = fastifyPlugin(hapiCompat, {
  name: "hapi-compat"
});
