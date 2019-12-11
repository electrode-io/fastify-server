"use strict";

const fastifyPlugin = require("fastify-plugin");

async function appContext(fastify, opts) {
  const {config} = opts;
  // Make config available in fastify.app.config, in addition to request.app.config.
  fastify.decorate("app", { config });
  fastify.decorateRequest("app", {});

  fastify.addHook("onRequest", (request, reply, done) => {
    // Provide new object, so that request.app is a fresh instance for each new request.
    request.app = { config };
    done();
  });
}

module.exports = fastifyPlugin(appContext, {
  name: "app-context"
});
