# Electrode Fastify Server [![NPM version][npm-image]][npm-url] [![Build Status][travis-image]][travis-url] [![Dependency Status][daviddm-image]][daviddm-url]

This is an imaginatively named, configurable web server using Fastify atop Node.js.

The aim is to provide a standardized node web server that can be used to serve your web
application without the need for duplicating from another example, or starting from scratch.

The intention is that you will extend via configuration, such that this provides the baseline
functionality of a Fastify web server, and within your own application you will add on the
features, logic, etc unique to your situation.

This module requires Node v10.x.x+.

# Table Of Contents

- [Electrode Fastify Server [![NPM version][npm-image]][npm-url] [![Build Status][travis-image]][travis-url] [![Dependency Status][daviddm-image]][daviddm-url]](#electrode-fastify-server-npm-versionnpm-url-build-statustravis-imagetravis-url-dependency-statusdaviddm-imagedaviddm-url)
- [Table Of Contents](#table-of-contents)
  - [Installing](#installing)
  - [Usage](#usage)
    - [Hello World Example](#hello-world-example)
  - [Configuration](#configuration)
  - [Configuration Options](#configuration-options)
    - [`server` (Object)](#server-object)
    - [`connection` (Object)](#connection-object)
    - [`plugins` (Object)](#plugins-object)
    - [`listener` (function)](#listener-function)
    - [logLevel](#loglevel)
  - [electrode-confippet](#electrode-confippet)
  - [Adding a Fastify plugin](#adding-a-fastify-plugin)
    - [Plugin configs](#plugin-configs)
      - [About Plugin Priority](#about-plugin-priority)
      - [More about register and module](#more-about-register-and-module)
      - [Exporting your Fastify Plugin from a module](#exporting-your-fastify-plugin-from-a-module)
      - [More about `requireFromPath`](#more-about-requirefrompath)
      - [Plugin timeout](#plugin-timeout)
    - [Example: `fastify-static`](#example-fastify-static)
  - [API](#api)
    - [electrodeServer](#electrodeserver)
    - [`app` decorator](#app-decorator)
  - [Contributions](#contributions)
  - [License](#license)

## Installing

`npm i --save @xarc/fastify-server`

## Usage

Electrode Server comes with enough defaults such that you can spin up a Fastify server at `http://localhost:3000` with one call:

```js
require("@xarc/fastify-server")();
```

Of course that doesn't do much but getting a `404` response from `http://localhost:3000`.
To handle your routes, you should create a Fastify plugin to install your handlers.
See below for configuration options on how to register your plugin through `@xarc/fastify-server`.

### Hello World Example

Here is an example with a default route to return a `Hello World` string for `http://localhost:3000`.

Through a plugin:

```js
require("@xarc/fastify-server")({
  plugins: {
    routes: {
      register: async instance => {
        instance.route({
          method: "GET",
          path: "/",
          handler: async () => "Hello World"
        });
      }
    }
  }
});
```

Using `deferStart` flag to get a server that hasn't started yet:

```js
//
// fastify doesn't allow adding routes after server started
// so need to set deferStart flag true to be able to add a route and then start the server.
//
require("@xarc/fastify-server")({ deferStart: true }).then(server => {
  server.route({
    method: "GET",
    path: "/",
    handler: async () => "Hello World"
  });
  return server.start();
});
```

## Configuration

You can pass in a config object that controls every aspect of the Fastify server.

For example, if you want to spin up a server with HTTP compression off at port 9000:

```js
const config = {
  connection: {
    port: 9000,
    compression: false
  }
};

require("@xarc/fastify-server")(config);
```

However, for a more complex application, it's recommended that you use a config composer such as [electrode-confippet] to manage your app configuration.

## Configuration Options

Sample of supported options:

```js
const config = {
  server: {
    // options to be passed to fastify constructor
  },
  connection: {
    // host, port etc
  },
  plugins: {
    // specify fastify plugins to be registered
  },
  listener: emitter => {
    // setup server startup event handlers
  },
  deferStart: true, // don't start the server, you need to call server.start()
  electrode: {
    // options specific to Electrode such as logLevel
  }
};
```

All properties are optional (if not present, the default values shown below will be used).

`server.app.config` is set to a object that's the combination of your config with `@xarc/fastify-server's` defaults applied.

### `server` (Object)

- Server options to pass to [Fastify]

**Default:**

```js
{
  server: {
    app: {
      electrode: true;
    }
  }
}
```

### `connection` (Object)

- Connection to setup for the Fastify server. Contains connection details for the server.
- If you want multiple connections, you can start multiple instances of `@xarc/fastify-server`

**Default:**

```js
{
  connection: {
    host: process.env.HOST,
    address: process.env.HOST_IP || "0.0.0.0",
    port: parseInt(process.env.PORT, 10) || 3000,
    routes: {
      cors: true
    }
  }
}
```

### `plugins` (Object)

- plugin registration objects, converted to an array of its values and passed to [Fastify's `server.register`]

Default is just empty object:

```js
{
  plugins: {
  }
}
```

### `listener` (function)

- A function to install event listeners for the electrode server startup lifecycle.

- The following events are supported:

  - `config-composed` - All configurations have been composed into a single one
  - `server-created` - Fastify server created
  - `plugins-sorted` - Plugins processed and sorted by priority
  - `plugins-registered` - Plugins registered with Fastify
  - `server-started` - Server started
  - `complete` - Final step before returning

To receive events you must set `config.listener` before calling `electrodeServer`.

For example:

```js
myConfig.listener = (emitter) => {
  emitter.on("server-created", (data, next) => {
    // do something
    next();
  });
});
```

- The data object will contain these: `emitter`, `server`, `config`, and `plugins`.

- Depending on the stage some may not be present. For example, `server` is not available until `server-created` event and `plugins` is not available until `plugins-sorted` event.

- These are async events so you have to take and call a `next` callback.

### logLevel

You can control how much output the Electrode Server logs to the console by setting the `logLevel`.

- Levels are `"info"`, `"warn"`, `"error"`, `"none"`.
- A level of `"warn"` means only warnning and error messages will be printed.
- **Default** is `"info"`

For example, to suppress the banner that is shown when the server starts up:

```
Fastify server running at http://mypc:4000
```

set the logLevel to "warn" or "error":

```js
{
  electrode: {
    logLevel: "warn";
  }
}
```

## electrode-confippet

To keep your environment specific configurations manageable, you can use [electrode-confippet].

Once you have your config files setup according to the [configuration files setup], you can simply pass the config object to electrode server.

```js
const config = require("electrode-confippet").config;

require("@xarc/fastify-server")(config);
```

## Adding a Fastify plugin

You can have `@xarc/fastify-server` register any Fastify plugin that you want
through your configuration file.

```js
{
  plugins: {
    "<plugin-id>": {
      enable: true,
      options: {},
      priority: 210,
      register: (fastify, opts, done) => { done() }, // mutual exclusive with module
      module: "<plugin-module-name>",
      requireFromPath: process.cwd(),
      fastifyPluginDecorate: false
    }
  }
}
```

### Plugin configs

- `<plugin-id>` - ID for the plugin. Generally the module name for the plugin, which is used to load it for registration.
- `register` - _optional_ The Fastify plugin function. Overrides `module`.
- `module` - _optional_ name of the module to load for the plugin instead of the `<plugin-id>`
- `requireFromPath` - _optional_ The path from which to call `require` to load the plugin module
- `fastifyPluginDecorate` - _optional_ fastify-server auto decorates your plugin with [fastify-plugin] - set this to `false` to disable this behavior. This can also be set to an object to use as options for [fastify-plugin].
- `enable` - _optional_ if set to `false` then this plugin won't be registered. If it's not set then it's considered to be `true`.
- `options` - _optional_ Object that's passed to the plugin's register function.
- `priority` - _optional_ integer value to indicate the plugin's registration order
  - Lower value ones are register first
  - Default to `Infinity` if this field is missing or has no valid integer value (`NaN`) (string of number accepted)

#### About Plugin Priority

Priority allows you to arrange plugins to be registered in an order you prefer. The plugins with lower priority values are registered first.

#### More about register and module

If you don't want to use `<plugin-id>` to load the module, then you can optionally specify one of the following:

- `register` - if specified, then treat as the plugin's `register` function to pass to Fastify, **_overides module_**
- `module` - Only used if `register` is not specified
  - If it's a string the used as the name module to `require` for registration.
  - It it's `false` then electrode server will not load any module.
  - You can specify a [require-from-path] for the module using an object.

```js
        {
          plugins: {
            myPlugin: {
              module: {
                requireFromPath: process.cwd(),
                name: "my-plugin-module"
              }
            }
          }
        }
```

#### Exporting your Fastify Plugin from a module

Electrode fastify server will try to find your Fastify Plugin from your module by looking through these fields:

1. `mod.fastifyPlugin`
2. `mod.default.fastifyPlugin` (ES6 Module)
3. `mod.plugin`
4. `mod.default` (ES6 Module)
5. `mod` itself

Examples:

1. Exporting the plugin directly as the module:

CommonJS example:

```js
module.exports = myPlugin;
```

```js
module.exports.fastifyPlugin = myPlugin;
```

ES6 example:

```js
export default myPlugin;
```

```js
export fastifyPlugin;
```

With `fastify-plugin`:

```js
const fastifyPlugin = require("fastify-plugin");
module.exports = fastifyPlugin(myPlugin, {
  name: "myPlugin"
});
```

#### More about `requireFromPath`

There are three places you can specify a path to call `require` from when loading your plugin modules.

1. `config.plugins.requireFromPath` - The top one used for all plugins
1. `config.plugins.<plugin-id>.requireFromPath` - Used for the specific plugin of `<plugin-id>`, **overrides the one above**
1. `config.plugins.<plugin-id>.module.requireFromPath` - Used for the specific plugin of `<plugin-id>`, **overrides the two above**

For more information: check out [require-from-path]

#### Plugin timeout

To configure the plugin timeout, use Fastify's `pluginTimeout` option.

```json
{
  "server": {
    "pluginTimeout": 10000
  }
}
```

Uses the Fastify default if none is specified.

### Example: `fastify-static`

**Here's an example using the `fastify-static` plugin:**

First, install the plugin as you normally would from `npm`:

`npm i --save fastify-static`

Then, add your plugin to the config `plugins` section.

```js
{
  plugins: {
    "fastify-static": {
      enable: true,
      options: {
        root: process.cwd()
      },
      priority: 210,
      requireFromPath: process.cwd()
    }
  }
}
```

Above config tells `@xarc/fastify-server` to `require` from `CWD` the module by its `<plugin-id>` `"fastify-static"` and register it as a plugin with Fastify. Options passes in the required `root` option to `fastify-static`.

## API

The electrode server exports a single API.

### [electrodeServer](#electrodeserver)

`electrodeServer(config, [decors], [callback])`

- `config` is the [electrode server config](#configuration-options)
- `decors` - Optional extra `config` or array of `config`. In case you have common config you want to put inside a dedicated module, you can pass them in here.

  - If it's an array like `[ decor1, decor2, decor3 ]` then each one is composed into the main config. ie: something similar to `_.merge(mainConfig, decor1, decor2, decor3)`.

- `callback` is an optional errback with the signature `function (err, server)`

  - where `server` is the Fastify server

- **Returns:** a promise resolving to the Fastify server if callback is not provided

### `app` decorator

Elecrode server also provides the `app` decorator on the server and request objects.
The `app` object contains the fully merged final `config`.

```js
handler: (request, reply) => {
  console.log("Listening on ", request.app.config.connection.port);
};
```

## Contributions

Make sure you sign the CLA. Checkout the [contribution guide](https://github.com/electrode-io/electrode/blob/master/CONTRIBUTING.md)

To run tests

```sh
% npm i
% clap test
```

To run tests and coverage

```sh
% clap check
```

To run sample server

```sh
% npm run sample
```

Hit `http://localhost:9000`
Hit `http://localhost:9000/html/hello.html` to test static path.

## License

Copyright 2016-present WalmartLabs

Licensed under the [Apache License, Version 2.0].

[electrode-confippet]: https://www.npmjs.com/package/electrode-confippet
[fastify]: https://www.fastify.io/
[fastify's `server.register`]: https://www.fastify.io/docs/latest/Server/#register
[configuration files setup]: https://www.npmjs.com/package/electrode-confippet#configuration-files
[npm-image]: https://badge.fury.io/js/@xarc%2Ffastify-server.svg
[npm-url]: https://npmjs.org/package/@xarc/fastify-server
[travis-image]: https://travis-ci.org/electrode-io/fastify-server.svg?branch=master
[travis-url]: https://travis-ci.org/electrode-io/fastify-server
[daviddm-image]: https://david-dm.org/electrode-io/fastify-server.svg?theme=shields.io
[daviddm-url]: https://david-dm.org/electrode-io/fastify-server
[require-from-path]: https://www.npmjs.com/package/require-from-path
[apache license, version 2.0]: https://www.apache.org/licenses/LICENSE-2.0
[fastify-plugin]: https://www.npmjs.com/package/fastify-plugin
