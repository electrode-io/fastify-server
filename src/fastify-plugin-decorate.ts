import fastifyPlugin from "fastify-plugin";

/**
 * Decorate a fastify plugin with the module fastify-plugin
 *
 * @param {*} plugin - the fastify plugin
 *
 * @returns {*} plugin
 */
export const fastifyPluginDecorate = plugin => {
  if (
    plugin.fastifyPluginDecorate !== false &&
    !plugin.register.hasOwnProperty(Symbol.for("skip-override"))
  ) {
    fastifyPlugin(plugin.register, { name: plugin.__name, ...plugin.fastifyPluginDecorate });
  }

  return plugin;
};
