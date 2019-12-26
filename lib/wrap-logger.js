"use strict";

const LEVELS = new Set(["fatal", "error", "warn", "info", "debug", "trace"]);

/**
 * Fastify requires a logger that implements the abstract-logging interface, see
 * https://www.npmjs.com/package/abstract-logging
 * with an additional method child(), see
 * https://github.com/fastify/fastify/blob/6d200b61b1948566dc6b9d2d71dd0bdfa0f52c98/lib/validation.js#L146
 * The Hapi ecosystem has a different logging interface.
 * This function merges the two interfaces by wrapping an existing fastify logger.
 * @param {Logger} logger that implements a Fastify-compatible interface, such as Pino.
 * @returns {Logger} logger that implements both Fastify- and Hapi-compatible interfaces.
 */
function wrapLogger(logger) {
  const fastifyCompatibleLogger = (tags, data) => {
    if (typeof tags === "string") {
      tags = [tags];
    }
    const newTags = []; // don't mutate original
    let level = "info";
    for (const tag of tags) {
      // is level case sensitive? e.g. ["INFO"] vs ["info"]
      if (LEVELS.has(tag)) {
        level = tag;
      } else {
        newTags.push(tag);
      }
    }
    if (newTags.length) {
      if (typeof data === "string") {
        data = { tags: newTags, msg: data };
      } else {
        data = { tags: newTags, ...data }; // don't mutate original
      }
    }
    logger[level](data);
  };
  for (const level of LEVELS) {
    fastifyCompatibleLogger[level] = (...args) => logger[level](...args);
  }
  fastifyCompatibleLogger.child = (properties) => wrapLogger(logger.child(properties));
  return fastifyCompatibleLogger;
}

module.exports = wrapLogger;
