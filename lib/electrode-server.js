"use strict";

/* eslint-disable no-magic-numbers, prefer-template, max-len */

const assert = require("assert");
const fastify = require("fastify");
const _ = require("lodash");
const Path = require("path");
const checkNodeEnv = require("./check-node-env");
const startFailed = require("./start-failed");
const Confippet = require("electrode-confippet");
const AsyncEventEmitter = require("async-eventemitter");
const requireAt = require("require-at");
const xaa = require("xaa");
const util = require("util");

const { fastifyPluginDecorate } = require("./fastify-plugin-decorate");

async function emitEvent(context, event) {
  const timeout = _.get(context, "config.electrode.eventTimeout", 10000);

  if (!context.emitter._events[event]) {
    return;
  }

  let promise = new Promise((resolve, reject) => {
    context.emitter.emit(event, context, err => {
      return err ? reject(err) : resolve();
    });
  });

  if (Number.isInteger(timeout) && timeout > 0) {
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
    if (p.register) {
      return fastifyPluginDecorate(p);
    }
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

      // order of fields to look for the hapi plugin from the module:
      // 1. mod.fastifyPlugin
      // 3. mod.default.fastifyPlugin (ES6)
      // 2. mod.plugin
      // 4. mod.default (ES6)
      // 5. mod
      const pluginField = ["fastifyPlugin", "default.fastifyPlugin", "plugin", "default"].find(x =>
        _.get(mod, x)
      );

      // validate plugin
      const pluginExport = (pluginField && _.get(mod, pluginField)) || mod;
      p.register = pluginExport.register || pluginExport;
      const msg = `for plugin '${p.__name}' from exported field '${pluginField}' of its module from '${name}'`;

      const validatePlugin = pos => {
        assert(pos.register, `register of plugin is falsy value: ${pos.register} - ${msg}`);
        assert(typeof pos.register === "function", `register of plugin is not a function - ${msg}`);
      };
      validatePlugin(p);

      return fastifyPluginDecorate(p);
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
  const pluginsArray = () => _(plugins).map(transpose).filter(isEnable).sortBy(priority).value();
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
    const regFail = (err, plugin) => {
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
      return err2;
    };

    //
    // - all register must be called before calling server.ready
    // - but registration only executed after server.ready is called
    // - So 1st call must setup all register calls and promises
    // -    2nd call calls after(), but actual execution wait for server.ready
    // -    3rd call wait for all registration to complete
    //
    const regPromises = plugins.map(async plugin => {
      try {
        const x = server.register(plugin.register, plugin.options);
        return await util.promisify(x.after)();
      } catch (err) {
        throw regFail(err, plugin);
      }
    });
    await Promise.all(regPromises);

    return emitEvent(context, "plugins-registered");
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
      await server.listen(config.connection.port, "0.0.0.0");
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

    //
    // This will allow Fastify to make config available through
    // server.settings.app.config
    //
    fastifyServerConfig.app.config = context.config;

    return fastifyServerConfig;
  };

  const start = async context => {
    const settings = makeFastifyServerConfig(context);

    const server = (context.server = fastify(settings));

    const SYM_PATH = Symbol("request.path");
    const SYM_INFO = Symbol("request.info");

    // add request.path and request.info as compatibility with Hapi
    server.decorateRequest("path", {
      getter() {
        return this[SYM_PATH] || (this[SYM_PATH] = this.raw.url.match("^[^?]*")[0]);
      }
    });

    // request.info
    server.decorateRequest("info", {
      getter() {
        return this[SYM_INFO] || (this[SYM_INFO] = { remoteAddress: this.ip });
      }
    });

    const SERVER_SYM_INFO = Symbol("server.info");
    // server.info micmic Hapi
    /*
    const sample = {
      created: 1593114093676,
      started: 1593114093685,
      host: "m-c02yw1s0lvdt",
      port: 3000,
      protocol: "http",
      id: "m-c02yw1s0lvdt:53774:kbv6zxws",
      uri: "http://m-c02yw1s0lvdt:3000",
      address: "0.0.0.0"
    };
    */
    server.decorate("info", {
      getter() {
        return (
          this[SERVER_SYM_INFO] ||
          (this[SERVER_SYM_INFO] = {
            get port() {
              const address = server.server.address();
              return address && address.port;
            },
            get address() {
              const address = server.server.address();
              return address && address.address;
            }
          })
        );
      }
    });

    server.decorate("settings", settings);

    // server.app
    server.decorate("app", { config: context.config });

    const SYM_APP = Symbol("request.app");

    // request.app, should be different for each request
    server.decorateRequest("app", {
      getter() {
        return this[SYM_APP] || (this[SYM_APP] = { config: context.config });
      }
    });

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
