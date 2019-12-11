"use strict";

const fastifyPlugin = require("fastify-plugin");

async function appContext(fastify, opts) {
  const freshApp = {
    // Make config available in server.app.config, in addition to
    // server.settings.app.config
    config: opts.config
  };
  fastify.decorate("app", {...freshApp});
  fastify.decorateRequest("app", {});

  fastify.addHook("onRequest", (request, reply, done) => {
    // Provide a copy, so that freshApp cannot get modified
    // and that request.app is a fresh instance for each new request.
    request.app = {...freshApp};
    done();
  });
}

module.exports = fastifyPlugin(appContext, {
  name: "app-context"
});
