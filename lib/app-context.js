"use strict";

const fastifyPlugin = require("fastify-plugin");

async function appContext(fastify, opts) {
  const app = {
    // Make config available in server.app.config, in addition to
    // server.settings.app.config
    config: opts.config
  };
  fastify.decorate("app", app);
  fastify.decorateRequest("app", app);
}

module.exports = fastifyPlugin(appContext, {
  name: "app-context"
});
