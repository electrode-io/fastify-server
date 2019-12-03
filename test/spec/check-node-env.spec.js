"use strict";

const checkNodeEnv = require("../../lib/check-node-env.js");
const logger = require("../../lib/logger.js");
const Chai = require("chai");

describe("process-env-abbr", function() {
  let saveEnv;

  before(() => {
    saveEnv = process.env.NODE_ENV;
  });

  after(() => {
    if (saveEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = saveEnv;
    }
  });

  it("should do nothing for empty NODE_ENV", function() {
    process.env.NODE_ENV = "";
    checkNodeEnv();
  });

  it("should do nothing for full NODE_ENV", function() {
    ["production", "staging", "development"].forEach(x => {
      process.env.NODE_ENV = x;
      checkNodeEnv();
    });
  });

  it("should print warning for unexpected NODE_ENV", function() {
    const w = logger.warn;
    let msg;
    logger.warn = m => {
      msg = m;
    };
    process.env.NODE_ENV = "undefined";
    checkNodeEnv();
    logger.warn = w;
    Chai.expect(msg).includes("should be empty or one of");
  });
});
