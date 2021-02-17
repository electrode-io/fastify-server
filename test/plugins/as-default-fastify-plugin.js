/* eslint-disable */

function fPlugin(fastify, opts, done) {
  fastify.decorate("utility", () => {
    return "bingo default.fastifyPlugin";
  });
  done();
}
fPlugin[Symbol.for("skip-override")] = true;
module.exports.default = { fastifyPlugin: fPlugin };
