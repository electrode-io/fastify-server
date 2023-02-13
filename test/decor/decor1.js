/* eslint-disable */

"use strict";

const path = require("path");

module.exports = {
  plugins: {
    "@fastify/static": {
      options: {
        root: path.join(__dirname, "../dist")
      }
    },
    staticPaths: {
      enable: true,
      module: path.join(__dirname, "../plugins/static-paths"),
      options: {
        quiet: false,
        pathPrefix: ""
      }
    }
  },
  listener: () => {}
};
