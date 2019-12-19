"use strict";

const sinon = require("sinon");
const chai = require("chai");
const wrapLogger = require("../../lib/wrap-logger");

const assert = chai.assert;
sinon.assert.expose(assert, { prefix: "" });

describe("wrapLogger()", function() {
  const createFakePino = () => ({
    fatal: sinon.fake(),
    error: sinon.fake(),
    warn: sinon.fake(),
    info: sinon.fake(),
    debug: sinon.fake(),
    trace: sinon.fake(),
    child: sinon.fake()
  });

  it("wraps logger.fatal()", async () => {
    const logger = createFakePino();
    const wrapped = wrapLogger(logger);
    wrapped.fatal("foo");
    assert.calledWith(logger.fatal, "foo");
  });

  it("wraps logger.error()", async () => {
    const logger = createFakePino();
    const wrapped = wrapLogger(logger);
    wrapped.error("foo");
    assert.calledWith(logger.error, "foo");
  });

  it("wraps logger.warn()", async () => {
    const logger = createFakePino();
    const wrapped = wrapLogger(logger);
    wrapped.warn("foo");
    assert.calledWith(logger.warn, "foo");
  });

  it("wraps logger.info()", async () => {
    const logger = createFakePino();
    const wrapped = wrapLogger(logger);
    wrapped.info("foo");
    assert.calledWith(logger.info, "foo");
  });

  it("wraps logger.debug()", async () => {
    const logger = createFakePino();
    const wrapped = wrapLogger(logger);
    wrapped.debug("foo");
    assert.calledWith(logger.debug, "foo");
  });

  it("wraps logger.trace()", async () => {
    const logger = createFakePino();
    const wrapped = wrapLogger(logger);
    wrapped.trace("foo");
    assert.calledWith(logger.trace, "foo");
  });

  it("wraps logger.child()", async () => {
    const logger = createFakePino();
    const wrapped = wrapLogger(logger);
    wrapped.child({foo: "foo"});
    assert.calledWith(logger.child, {foo: "foo"});
  });

  describe("Hapi logger interface", () => {
    it("directs to logger.info()", async () => {
      const logger = createFakePino();
      const wrapped = wrapLogger(logger);
      wrapped("info", "foo");
      assert.calledWith(logger.info, "foo");
    });

    it("directs to logger.error()", async () => {
      const logger = createFakePino();
      const wrapped = wrapLogger(logger);
      wrapped("error", "foo");
      assert.calledWith(logger.error, "foo");
    });

    it("directs to logger.info() with tags supplied as array", async () => {
      const logger = createFakePino();
      const wrapped = wrapLogger(logger);
      wrapped(["info"], "foo");
      assert.calledWith(logger.info, "foo");
    });

    it("adds extra tags added to the log payload", async () => {
      const logger = createFakePino();
      const wrapped = wrapLogger(logger);
      wrapped(["info", "other"], "foo");
      assert.calledWith(logger.info, { msg: "foo", tags: ["other"] });
    });

    it("defaults to info", async () => {
      const logger = createFakePino();
      const wrapped = wrapLogger(logger);
      wrapped([], "foo");
      assert.calledWith(logger.info, "foo");
    });

    it("doesn't modify its arguments", async () => {
      const logger = createFakePino();
      const wrapped = wrapLogger(logger);
      const tags = ["info", "tag1", "tag2"];
      const data = { a: 1, b: 2 };
      wrapped(tags, data);
      assert.deepEqual(tags, ["info", "tag1", "tag2"]);
      assert.deepEqual(data, { a: 1, b: 2 });
    });
  });
});
