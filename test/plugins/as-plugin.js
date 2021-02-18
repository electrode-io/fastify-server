/* eslint-disable */

function fPlugin(fastify, opts, done) {
  fastify.decorate("utility", () => {
    return "bingo plugin";
  });
  done();
}
fPlugin[Symbol.for("skip-override")] = true;
module.exports.plugin = fPlugin;
