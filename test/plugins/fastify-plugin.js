function fPlugin(fastify, opts, done) {
  fastify.decorate("utility", () => {
    return "bingo";
  });
  done();
}
fPlugin[Symbol.for("skip-override")] = true;
module.exports.default = fPlugin;
