"use strict";

/* eslint-disable no-magic-numbers, prefer-template */

const assert = require("assert");
const fastify = require("fastify");
const _ = require("lodash");
const Path = require("path");
const pino = require("pino");
const checkNodeEnv = require("./check-node-env");
const wrapLogger = require("./wrap-logger");
const startFailed = require("./start-failed");
const appContext = require("./app-context");
const hapiCompat = require("./hapi-compat");
const Confippet = require("electrode-confippet");
const AsyncEventEmitter = require("async-eventemitter");
const requireAt = require("require-at");
const xaa = require("xaa");
const util = require("util");

async function emitEvent(context, event) {
  const timeout = _.get(context, "config.electrode.eventTimeout");

  if (timeout && !context.emitter._events[event]) {
    return;
  }

  let promise = new Promise((resolve, reject) => {
    context.emitter.emit(event, context, err => {
      return err ? reject(err) : resolve();
    });
  });

  if (timeout) {
    promise = xaa.runTimeout(promise, timeout);
  }

  try {
    await promise;
  } catch (error) {
    const massageError = err => {
      err.timeout = timeout;
      err.event = event;
      if (err instanceof xaa.TimeoutError) {
        err.message = `timeout waiting for event '${event}' handler`;
        err.code = "XEVENT_TIMEOUT";
      } else {
        err.message = `event '${event}' handler failed: ${err.message}`;
        err.code = "XEVENT_FAILED";
      }
      return err;
    };
    throw massageError(error);
  }
}

async function convertPluginsToArray(plugins) {
  //
  // The module could either be one in node_modules or a file in a path
  // relative to CWD
  // * module in node_modules: no leading "."
  // * file in a directory, relative path with leading "." under CWD, resolve
  //   full path for require
  //
  const fullRequirePath = x => {
    return x.startsWith(".") ? Path.resolve(x) : x;
  };

  const topRequireFromPath = plugins.requireFromPath;

  assert(
    !topRequireFromPath || _.isString(topRequireFromPath),
    `config.plugins.requireFromPath must be a string`
  );

  const loadModule = async p => {
    if (p.register) return p;
    // if p.register is not defined then check p.module
    // if no p.module or p.module !== false, then use field name (p.__name)

    const getPluginModule = () => {
      const requireFromPath = p.requireFromPath;
      if (_.isString(p.module)) {
        return { name: p.module, requireFromPath };
      } else if (_.isObject(p.module)) {
        assert(p.module.name, `plugin ${p.__name} 'module' must have 'name' field`);
        assert(
          !p.module.requireFromPath || _.isString(p.module.requireFromPath),
          `plugin ${p.__name} 'module.requireFromPath' must be a string`
        );
        return Object.assign({ requireFromPath }, p.module);
      } else if (p.module !== false) {
        return { name: p.__name, requireFromPath };
      }
      throw new Error(`plugin ${p.__name} disable 'module' but has no 'register' field`);
    };

    const doRequire = async () => {
      const pluginMod = getPluginModule();
      let name;
      let mod = null;

      const requireMod = () => {
        //
        // if has a name for the module to load, then try to load it.
        //
        let fromPath = pluginMod.requireFromPath || topRequireFromPath;
        let xrequire;

        if (fromPath) {
          name = pluginMod.name;
          // use require-at to load the module from path
          xrequire = requireAt(fromPath);
          p.requireFromPath = fromPath;
          fromPath = ` from path: ${fromPath}`;
        } else {
          // use require to load the module
          xrequire = require;
          name = fullRequirePath(pluginMod.name);
          fromPath = p.requireFromPath = "";
        }
        try {
          mod = xrequire(name);
        } catch (error) {
          error.message = `Failed loading module ${pluginMod.name}${fromPath}: ${error.message}`;
          throw error;
        }
      };

      requireMod();

      // order of fields to look for the Fastify plugin from the module:
      // 1. mod.register
      // 4. mod.default (ES6)
      // 5. mod
      const plugin = ["plugin", "default"].find(x => _.get(mod, x));
      // validate plugin
      p.register = (plugin && _.get(mod, plugin)) || mod;

      const validatePlugin = pos => {
        assert(pos.register, `Plugin ${name} is a falsy value: ${pos.register}`);
        assert(typeof pos.register === "function", `Plugin ${name} should be a function`);
      };
      validatePlugin(p);
      return p;
    };

    return doRequire();
  };

  const num = x => {
    return _.isString(x) ? parseInt(x, 10) : x;
  };

  const checkNaN = x => {
    return isNaN(x) ? Infinity : x;
  };

  const priority = p => checkNaN(num(p.priority));
  const isEnable = p => p.__name !== "requireFromPath" && p.enable !== false;
  const transpose = (p, k) => Object.assign({ __name: k }, p);

  //
  // transpose each plugin, filter out disabled ones, and sort by priority
  //
  const pluginsArray = () =>
    _(plugins)
      .map(transpose)
      .filter(isEnable)
      .sortBy(priority)
      .value();
  // convert plugins object to array and check each one if it has a module to load.
  const arr = pluginsArray();
  return xaa.map(arr, loadModule);
}

async function startElectrodeServer(context) {
  const server = context.server;
  const config = context.config;
  let started = false;

  const registerPlugins = async plugins => {
    const errorRegisterMessage = plg => {
      if (plg.module) {
        const fromPath = plg.requireFromPath ? ` from path: '${plg.requireFromPath}'` : "";
        return `with module '${JSON.stringify(plg.module)}'${fromPath}`;
      } else {
        return `with register function`;
      }
    };

    await xaa.map(
      plugins,
      async plugin => {
        try {
          const x = server.register(plugin.register, plugin.options);
          await util.promisify(x.after)();
        } catch (err) {
          let err2 = err;
          if (!err || !err.hasOwnProperty("message")) {
            err2 = new Error(err);
          } else if (err.code === "ERR_AVVIO_PLUGIN_TIMEOUT") {
            err2.message = `plugin '${plugin.__name}' with register function timeout \
- did you return a resolved promise?`;
          }

          err2.code = "XPLUGIN_FAILED";
          err2.plugin = plugin;
          err2.method = errorRegisterMessage(plugin);
          throw err2;
        }
      },
      // it's important to register all plugins at once before calling server.ready
      { concurrency: plugins.length }
    );

    await emitEvent(context, "plugins-registered");
  };

  const handleFail = async err => {
    if (started) {
      await server.close();
    }
    return await startFailed(err);
  };

  const startServer = async () => {
    try {
      // must call ready to kick off the plugin registration
      await context.server.ready();
      await context.registerPluginsPromise;
      await server.listen(config.connection.port);
      started = true;
      await emitEvent(context, "server-started");
      await emitEvent(context, "complete");
    } catch (err) {
      await handleFail(err);
    }
  };

  const setupServer = async () => {
    context.server.decorate("start", startServer);
    await emitEvent(context, "server-created");
    const plugins = await convertPluginsToArray(config.plugins);
    context.plugins = plugins;
    await emitEvent(context, "plugins-sorted");
    context.registerPluginsPromise = registerPlugins(context.plugins);
  };

  try {
    await setupServer();
  } catch (err) {
    return await handleFail(err);
  }

  if (!context.config.deferStart) {
    await startServer();
  }

  return server;
}

module.exports = async function electrodeServer(appConfig = {}, decors) {
  const check = () => {
    checkNodeEnv();

    if (_.isArray(decors)) {
      decors = decors.filter(_.identity).map(x => (_.isFunction(x) ? x() : x));
    } else {
      decors = [].concat(decors).filter(_.identity);
    }
  };

  check();

  const makeFastifyServerConfig = context => {
    const fastifyServerConfig = {
      app: {
        electrodeServer: true
      }
    };

    Confippet.util.merge(fastifyServerConfig, context.config.server);
    _.assign(fastifyServerConfig, context.config.connection);

    // Set the log level (if no config value set, then we log all)
    const pinoOptions = _.get(context, "config.electrode.pinoOptions");
    const logger = pino(pinoOptions);
    fastifyServerConfig.logger = wrapLogger(logger);

    //
    // This will allow Fastify to make config available through
    // server.settings.app.config
    //
    fastifyServerConfig.app.config = context.config;

    return fastifyServerConfig;
  };

  const start = async context => {
    const settings = makeFastifyServerConfig(context);

    context.server = fastify(settings);

    context.server.decorate("settings", settings);

    // Register Electrode plugins
    context.server.register(appContext, { config: context.config });
    context.server.register(hapiCompat);

    // Start server
    return startElectrodeServer(context);
  };

  const applyDecorConfigs = context => {
    // load internal defaults
    const configOptions = {
      dirs: [Path.join(__dirname, "config")],
      warnMissing: false,
      failMissing: false,
      context: {
        deployment: process.env.NODE_ENV
      }
    };

    const defaults = Confippet.store();
    defaults._$.compose(configOptions);

    // apply decors
    decors.forEach(d => defaults._$.use(d));

    // apply appConfig
    defaults._$.use(appConfig);

    context.config = defaults;

    delete defaults.listener;

    return context;
  };

  const setListeners = context => {
    context.emitter = new AsyncEventEmitter();
    decors.forEach(d => {
      return d.listener && d.listener(context.emitter);
    });

    if (appConfig.listener) {
      appConfig.listener(context.emitter);
    }

    return context;
  };

  let ctx = setListeners({});
  ctx = applyDecorConfigs(ctx);
  await emitEvent(ctx, "config-composed");
  return await start(ctx);
};
