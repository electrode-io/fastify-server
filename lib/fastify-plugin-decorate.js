"use strict";

const fastifyPlugin = require("fastify-plugin");

const fastifyPluginDecorate = p => {
  if (
    p.fastifyPluginDecorate !== false &&
    !p.register.hasOwnProperty(Symbol.for("skip-override"))
  ) {
    fastifyPlugin(p.register, { name: p.__name, ...p.fastifyPluginDecorate });
  }

  return p;
};

module.exports.fastifyPluginDecorate = fastifyPluginDecorate;
