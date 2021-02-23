"use strict";

const dist = require("./lib");

module.exports = (...args) => dist.electrodeServer(...args);

Object.assign(module.exports, dist);
