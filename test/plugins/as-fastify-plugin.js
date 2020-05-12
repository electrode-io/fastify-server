function fPlugin(fastify, opts, done) {
  fastify.decorate("utility", () => {
    return "bingo fastifyPlugin";
  });
  done();
}
fPlugin[Symbol.for("skip-override")] = true;
module.exports.fastifyPlugin = fPlugin;
