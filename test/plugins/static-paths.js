"use strict";

const fastifyPlugin = require("fastify-plugin");
const fastifyStatic = require("fastify-static");
const Path = require("path");
const Chalk = require("chalk");
//
// Fastify plugin to serve static files from directories
// js, images, and html under ${options.pathPrefix}.
//

const StaticPaths = async (server, options) => {
  let pathPrefix = "";

  if (options.pathPrefix) {
    pathPrefix = options.pathPrefix;
    if (!options.quiet) {
      const msg = `staticPaths Plugin: static files path prefix "${pathPrefix}"`;
      console.log(Chalk.inverse.green(msg)); // eslint-disable-line
    }
  }

  server.register(fastifyStatic, {
    root: Path.resolve(pathPrefix, "js"),
    prefix: "/js/",
    decorateReply: false
  });
  server.register(fastifyStatic, {
    root: Path.resolve(pathPrefix, "images"),
    prefix: "/images/",
    decorateReply: false
  });
  server.register(fastifyStatic, {
    root: Path.resolve(pathPrefix, "html"),
    prefix: "/html/",
    decorateReply: false
  });
};

module.exports = fastifyPlugin(StaticPaths, {
  name: "electrodeServerStaticPaths",
  dependencies: ["fastify-static"]
});
