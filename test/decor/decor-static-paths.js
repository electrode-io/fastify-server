"use strict";

const path = require("path");

module.exports = {
  plugins: {
    "fastify-static": {
      priority: 100,
      options: {
        root: path.join(__dirname, "../dist")
      }
    },

    staticPaths2: {
      priority: 120,
      module: path.join(__dirname, `../plugins/static-paths.js`),
      options: {
        pathPrefix: "",
        config: {}
      }
    }
  }
};
