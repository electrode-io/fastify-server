/* eslint-disable */

"use strict";
const fastifyPlugin = require("fastify-plugin");
const path = require("path");

const eventReceived = [];
const pluginServer = async server => {
  server.route({
    method: "GET",
    path: "/",
    handler: (req, reply) => {
      const listEvents = eventReceived.join(", ");
      reply.send(`Received Events: [${listEvents}]`);
    }
  });
};

const config = {
  connection: {
    port: 9000
  },
  plugins: {
    "fastify-static": {
      priority: 100,
      options: {
        root: path.join(__dirname, "../dist")
      }
    },
    default: {
      register: fastifyPlugin(pluginServer, {
        name: "Plugin"
      })
    },
    staticPaths: {
      module: path.join(__dirname, `../plugins/static-paths.js`),
      options: {
        pathPrefix: path.join(__dirname, "../dist")
      }
    }
  },
  listener: emitter => {
    emitter.on("server-created", () => {
      eventReceived.push("server-created");
    });
    emitter.on("config-composed", () => {
      eventReceived.push("config-composed");
    });
    emitter.on("plugins-sorted", () => {
      eventReceived.push("plugins-sorted");
    });
    emitter.on("plugins-registered", () => {
      eventReceived.push("plugins-registered");
    });
    emitter.on("server-started", () => {
      eventReceived.push("server-started");
    });
    emitter.on("complete", () => {
      eventReceived.push("complete");
    });
  }
};
require("../../")(config);
