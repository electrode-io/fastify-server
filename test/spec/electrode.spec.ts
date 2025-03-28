/* eslint-disable */

"use strict";

const path = require("path");
const { electrodeServer } = require("../../src/electrode-server");
const _ = require("lodash");
const request = require("superagent");
const xaa = require("xaa");
const { asyncVerify, expectError, runFinally } = require("run-verify");
const xstdout = require("xstdout");
import assert from "node:assert";

import { ElectrodeFastifyInstance } from "../../src/types";

const HTTP_404 = 404;

describe("fastify-server", function () {
  const logLevel = "none";

  beforeEach(() => {
    /**
     * @warn electrode wants to backfile NODE_ENV, and jest wants to set it
     * to test. Undo jest, allow electrode to do its thing
     */
    delete process.env.NODE_ENV;
    process.env.PORT = "3000";
  }, 10_000);

  let server: ElectrodeFastifyInstance;

  const stopServer = s => s && s.close();

  afterEach(() => {
    delete process.env.PORT;
    const s = server;
    server = undefined;
    return stopServer(s);
  }, 10_000);

  const verifyServer = s => {
    return asyncVerify(
      () => assert(s.app.config, "server.app.config not available"),
      expectError(next => {
        return request.get(`http://127.0.0.1:${server.info.port}/html/test.html`).end(next);
      }),
      error => {
        assert.equal(error.message, "Not Found");
        assert.equal(error.status, HTTP_404);
        const resp = error.response;
        assert.ok(resp, "No response from server");
        assert.ok(resp.body, "Response has no body");
        assert.equal(resp.body.error, "Not Found");
        assert.equal(resp.body.statusCode, HTTP_404);
      }
    );
  };

  const testSimplePromise = async (config, decors) => {
    server = await electrodeServer(config, decors);
    await verifyServer(server);
    await stopServer(server);
    server = undefined;
  };

  it("should start up a default server twice", async () => {
    await testSimplePromise(
      {
        electrode: {
          logLevel,
          hostname: "blah-test-923898234" // test bad hostname
        }
      },
      [require("../decor/decor1.js")]
    );
    return await testSimplePromise(undefined, require("../decor/decor2"));
  }, 10_000);

  it("should offer server.info before/after server start", async () => {
    server = await electrodeServer({
      deferStart: true,
      connection: {
        port: 5900
      }
    });
    // before start
    expect(server.info.port).toBe(null);
    expect(server.info.address).toBe(null);
    await server.start();
    // after start
    expect(server.info.port).toBe(5900);
    expect(server.info.address).toBe("0.0.0.0");
  }, 10_000);

  it("should support deferStart to allow user to add routes to server", () => {
    return asyncVerify(async () => {
      server = await electrodeServer({ deferStart: true });
      server.route({
        method: "GET",
        url: "/",
        handler: async () => "foo"
      });
      await server.start();
    });
  }, 10_000);

  it("should default keepAliveTimeout to 60 seconds", async () => {
    server = await electrodeServer({});
    expect(server.initialConfig.keepAliveTimeout).toBe(60000);
    expect(server.server.keepAliveTimeout).toBe(60000);
  }, 10_000);

  it("can configure keepAliveTimeout", async () => {
    server = await electrodeServer({
      keepAliveTimeout: 6001
    });
    expect(server.initialConfig.keepAliveTimeout).toBe(6001);
    expect(server.server.keepAliveTimeout).toBe(6001);
  }, 10_000);

  it("can configure keepAliveTimeout using electrode style", async () => {
    server = await electrodeServer({
      electrode: {
        keepAliveTimeout: 6002
      }
    });
    expect(server.initialConfig.keepAliveTimeout).toBe(6002);
    expect(server.server.keepAliveTimeout).toBe(6002);
  }, 10_000);

  it("should fail for PORT in use", () => {
    const intercept = xstdout.intercept(true);
    return asyncVerify(
      expectError(async () => {
        server = await electrodeServer();
        await electrodeServer({
          connection: {
            port: server.info.port
          },
          electrode: {
            logLevel
          }
        });
      }),
      error => {
        expect(error.constructor.name).toBe("Error");
        expect(error.message).toMatch(/is already in use/gm);
      },
      runFinally(() => intercept.restore()),
      runFinally(() => server.close())
    );
  }, 10_000);

  it("should fail for listener errors", () => {
    return asyncVerify(
      expectError(() => electrodeServer({}, require("../decor/decor3"))),
      error => {
        expect(error.constructor.name).toBe("Error");
        expect(error.message).toMatch(/test listner error/gm);
      }
    );
  }, 10_000);

  it("should fail for listener errors from decor array with func", () => {
    return asyncVerify(
      expectError(() => electrodeServer({}, [require("../decor/decor4")])),
      error => {
        expect(error.constructor.name).toBe("Error");
        expect(error.message).toMatch(/test listner error/gm);
      }
    );
  }, 10_000);

  it("should fail if plugins.requireFromPath is not string", () => {
    const intercept = xstdout.intercept(true);
    const options = { electrode: { logLevel: "none" }, plugins: { requireFromPath: {} } };
    return asyncVerify(
      expectError(() => electrodeServer(options)),
      error => {
        expect(error.constructor.name).toBe("AssertionError");
        expect(error.message).toMatch(/config.plugins.requireFromPath must be a string/gm);
      },
      runFinally(() => intercept.restore())
    );
  }, 10_000);

  it("should fail if can't load module from requireFromPath", () => {
    const intercept = xstdout.intercept(true);
    const options = {
      electrode: { logLevel: "none" },
      plugins: {
        requireFromPath: "/",
        "fastify-plugin": {}
      }
    };
    return asyncVerify(
      expectError(() => electrodeServer(options)),
      error => {
        expect(error.constructor.name).toBe("ModuleNotFoundError");
        expect(error.message).toMatch(/Failed loading module fastify-plugin from path/gm);
        expect(error.message).toMatch(/Cannot find module 'fastify-plugin'/gm);
      },
      runFinally(() => intercept.restore())
    );
  }, 10_000);

  it("should fail if can't load module from module.requireFromPath", () => {
    const options = {
      electrode: { logLevel: "none" },
      plugins: {
        "plugin-module-not-found": {
          module: {
            requireFromPath: "/",
            name: "fastify-plugin"
          }
        }
      }
    };
    const intercept = xstdout.intercept(true);

    return asyncVerify(
      expectError(() => electrodeServer(options)),
      error => {
        expect(error.constructor.name).toBe("ModuleNotFoundError");
        expect(error.message).toMatch(/Failed loading module fastify-plugin from path/gm);
        expect(error.message).toMatch(/Cannot find module 'fastify-plugin'/gm);
      },
      runFinally(() => intercept.restore())
    );
  }, 10_000);

  it("should start up with @empty_config", async () => {
    server = await electrodeServer();
  }, 10_000);

  it("should start up with @correct_plugins_priority", () => {
    return asyncVerify(
      async () => (server = await electrodeServer(require("../data/server.js"))),
      () => {
        const fserver: any = server;
        assert.ok(fserver.testPlugin, "testPlugin missing in server");
        assert.ok(fserver.es6StylePlugin, "es6StylePlugin missing in server");
      }
    );
  }, 10_000);

  it("should return static file", () => {
    const config = {
      server: {
        host: "127.0.0.1",
        port: 3000,
        logger: { level: "info" }
      },
      plugins: {
        appConfig: {
          module: path.join(__dirname, "../plugins/app-config"),
          options: {}
        },
        staticPaths2: {
          options: {
            pathPrefix: path.join(__dirname, "../dist")
          }
        }
      }
    };
    const intercept = xstdout.intercept(true);

    return asyncVerify(
      async () => {
        server = await electrodeServer(config, [require("../decor/decor-static-paths")]);
        const resp = await request.get(`http://127.0.0.1:${server.info.port}/html/hello.html`);
        assert(resp, "Server didn't return response");
        assert(resp.text.includes("Hello Test!"), "response not contain expected string");
      },
      runFinally(() => intercept.restore())
    );
  }, 10_000);

  it("should fail for invalid plugin spec", () => {
    const options = {
      electrode: { logLevel: "none" },
      plugins: { invalid: { module: false } }
    };
    const intercept = xstdout.intercept(true);

    return asyncVerify(
      expectError(() => electrodeServer(options)),
      error => {
        expect(error.constructor.name).toBe("Error");
        expect(error.message).toMatch(
          /plugin invalid disable 'module' but has no 'register' field/
        );
      },
      runFinally(() => intercept.restore())
    );
  }, 10_000);

  it("should fail start up due to @plugin_error", () => {
    const intercept = xstdout.intercept(true);

    return asyncVerify(
      expectError(() => electrodeServer(require("../data/server-with-plugin-error.js"))),
      error => {
        expect(error.constructor.name).toBe("Error");
        expect(error.message).toMatch(/plugin_failure/);
      },
      runFinally(() => intercept.restore())
    );
  }, 10_000);

  it("should fail start up due to @bad_plugin", () => {
    const intercept = xstdout.intercept(true);
    return asyncVerify(
      expectError(() => electrodeServer(require("../data/bad-plugin.js"))),
      error => {
        expect(error.constructor.name).toBe("ReferenceError");
        expect(error.message).toMatch(/Failed loading module .\/test\/plugins\/err-plugin/);
      },
      runFinally(() => intercept.restore())
    );
  }, 10_000);

  it("should fail with plugins register timeout", () => {
    const register = () => {
      return new Promise(() => {});
    };
    const options = {
      plugins: {
        test: {
          register,
          name: "timeout"
        }
      },
      server: {
        pluginTimeout: 1000
      },
      electrode: {
        logLevel
      }
    };
    const intercept = xstdout.intercept(true);

    return asyncVerify(
      expectError(() => electrodeServer(options)),
      error => {
        expect(error.constructor.name).toBe("FastifyError");
        expect(error.message).toMatch(/failed registering your plugin 'test' with register/gm);
      },
      runFinally(() => intercept.restore())
    );
  }, 10_000);

  const testNoAbort = async mode => {
    const save = process.execArgv;
    process.execArgv = [mode];
    const register = () => {
      return xaa
        .runTimeout(
          new Promise(() => {
            // never resolves or rejects
          }),
          200
        )
        .catch(() => Promise.reject(new Error("--- test timeout ---")))
        .then(() => Promise.reject(new Error("test failure")));
    };
    const options = {
      plugins: {
        test: {
          register,
          name: "timeout"
        }
      },
      electrode: {
        logLevel,
        registerPluginsTimeout: 100
      }
    };

    const intercept = xstdout.intercept(true);
    return asyncVerify(
      runFinally(() => (process.execArgv = save)),
      expectError(() => electrodeServer(options)),
      error => {
        expect(error.constructor.name).toBe("Error");
        expect(error.message).toMatch(/--- test timeout ---/gm);
      },
      runFinally(() => intercept.restore())
    );
  };

  it("should not abort with plugins register timeout in inspect mode", () => {
    return testNoAbort("--inspect");
  }, 10_000);

  it("should not abort with plugins register timeout in inspect-brk mode", () => {
    return testNoAbort("--inspect-brk");
  }, 10_000);

  it("should fail if plugin register returned error", () => {
    const register = async () => {
      throw new Error("test plugin register returning error");
    };
    const options = {
      plugins: {
        test: {
          register,
          name: "errorPlugin"
        }
      },
      electrode: {
        logLevel
      }
    };
    const intercept = xstdout.intercept(true);

    return asyncVerify(
      expectError(() => electrodeServer(options)),
      error => {
        expect(error.constructor.name).toBe("Error");
        expect(error.message).toMatch(/test plugin register returning error/gm);
      },
      runFinally(() => intercept.restore())
    );
  }, 10_000);

  it("should fail if plugin with module register returned error", () => {
    const options = {
      plugins: {
        test: {
          module: path.join(__dirname, "../plugins/fail-plugin")
        }
      },
      electrode: {
        logLevel
      }
    };
    const intercept = xstdout.intercept(true);

    return asyncVerify(
      expectError(() => electrodeServer(options)),
      error => {
        expect(error.constructor.name).toBe("Error");
        expect(error.message).toMatch(/fail-plugin/gm);
        expect(error.code).toBe("XPLUGIN_FAILED");
        expect(error.method).toMatch(/with module/gm);
      },
      runFinally(() => intercept.restore())
    );
  }, 10_000);

  it("should fail plugin with string instead of error", async () => {
    const options = {
      plugins: {
        test: {
          module: path.join(__dirname, "../plugins/fail-plugin-with-message")
        }
      }
    };

    const intercept = xstdout.intercept(true);

    return asyncVerify(
      expectError(() => electrodeServer(options)),
      error => {
        expect(error.constructor.name).toBe("Error");
        expect(error.message).toMatch(/fail-plugin/gm);
        expect(error.code).toBe("XPLUGIN_FAILED");
        expect(error.method).toMatch(/with module/gm);
      },
      runFinally(() => intercept.restore())
    );
  }, 10_000);

  it("should fail if plugin with requireFromPath and module register returned error", () => {
    const options = {
      plugins: {
        test: {
          requireFromPath: __dirname,
          module: "../plugins/fail-plugin"
        }
      },
      electrode: {
        logLevel
      }
    };

    const intercept = xstdout.intercept(true);

    return asyncVerify(
      expectError(() => electrodeServer(options)),
      error => {
        expect(error.constructor.name).toBe("Error");
        expect(error.message).toMatch(/fail-plugin/gm);
      },
      runFinally(() => intercept.restore())
    );
  }, 10_000);

  it("should fail if plugin register failed", async () => {
    const register = async () => {
      throw new Error("test plugin failure");
    };

    const options = {
      plugins: {
        test: {
          register,
          name: "errorPlugin"
        }
      },
      electrode: {
        logLevel
      }
    };

    const intercept = xstdout.intercept(true);

    return asyncVerify(
      expectError(() => electrodeServer(options)),
      error => {
        expect(error.constructor.name).toBe("Error");
        expect(error.message).toMatch(/test plugin failure/gm);
      },
      runFinally(() => intercept.restore())
    );
  }, 10_000);

  it("should load default config when no environment specified", async () => {
    server = await electrodeServer();
    assert.equal(server.app.config.electrode.source, "development");
  }, 10_000);

  it("should load production config based on environment", async () => {
    process.env.NODE_ENV = "production";

    try {
      server = await electrodeServer();
      assert.equal(server.app.config.electrode.source, "production");
    } finally {
      process.env.NODE_ENV = "test";
    }
  }, 10_000);

  it("should load staging config based on environment", async () => {
    process.env.NODE_ENV = "staging";

    try {
      server = await electrodeServer();
      assert.equal(server.app.config.electrode.source, "staging");
    } finally {
      process.env.NODE_ENV = "test";
    }
  }, 10_000);

  it("should skip env config that doesn't exist", async () => {
    process.env.NODE_ENV = "development";

    try {
      server = await electrodeServer();
      assert.equal(server.app.config.electrode.source, "development");
    } finally {
      process.env.NODE_ENV = "test";
    }
  }, 10_000);

  it("should emit lifecycle events", async () => {
    const events = [
      "config-composed",
      "server-created",
      "plugins-sorted",
      "plugins-registered",
      "server-started",
      "complete"
    ];

    const firedEvents = _.times(events.length, _.constant(false));

    const eventListener = emitter => {
      _.each(events, (event, index) => {
        emitter.on(event, (data, next) => {
          firedEvents[index] = true;
          assert(data, "data should be set");
          assert(data.config, "config values should be set");

          assert(index > 0 ? data.server : true, "server should be set");
          assert(index > 1 ? data.plugins : true, `plugins should be set`);
          next();
        });
      });
    };

    const options = {
      listener: eventListener
    };
    const intercept = xstdout.intercept(true);

    return asyncVerify(
      async () => (server = await electrodeServer(options)),
      () => {
        assert(firedEvents.indexOf(false) === -1, "failed to fire event.");
      },
      runFinally(() => intercept.restore())
    );
  }, 10_000);

  it("should handle event handler timeout error", () => {
    const eventListener = emitter => {
      emitter.on("plugins-sorted", (data, next) => {}); // eslint-disable-line
    };

    const options = {
      electrode: { logLevel, eventTimeout: 20 },
      listener: eventListener
    };
    const intercept = xstdout.intercept(true);

    return asyncVerify(
      expectError(() => electrodeServer(options)),
      error => {
        expect(error.constructor.name).toBe("TimeoutError");
        expect(error.code).toBe("XEVENT_TIMEOUT");
      },
      runFinally(() => intercept.restore())
    );
  }, 10_000);

  it("should not timeout event handlers if it's 0", () => {
    let emitted = false;
    const eventListener = emitter => {
      emitter.on("plugins-sorted", (data, next) => {
        setTimeout(() => {
          emitted = true;
          next();
        }, 50);
      });
    };

    const options = {
      electrode: { logLevel, eventTimeout: 0 },
      listener: eventListener
    };
    const intercept = xstdout.intercept(true);

    return asyncVerify(
      () => electrodeServer(options),
      s => {
        server = s;
        expect(emitted).toBe(true);
      },
      runFinally(() => intercept.restore())
    );
  }, 10_000);

  it("should handle event handler error", () => {
    const eventListener = emitter => {
      emitter.on("plugins-sorted", (data, next) => {
        next(new Error("oops"));
      });
    };

    const options = {
      electrode: { logLevel, eventTimeout: 20 },
      listener: eventListener
    };
    const intercept = xstdout.intercept(true);

    return asyncVerify(
      expectError(() => electrodeServer(options)),
      error => {
        expect(error.constructor.name).toBe("Error");
        expect(error.code).toBe("XEVENT_FAILED");
      },
      runFinally(() => intercept.restore())
    );
  }, 10_000);

  it("should stop server if error occurred after it's started", () => {
    let saveServer;
    let stopped;
    const fakeClose = () => {
      stopped = true;
      return saveServer._close();
    };
    const eventListener = emitter => {
      emitter.on("server-started", (data, next) => {
        saveServer = server = data.server;
        (server as any)._close = server.close;
        server.close = fakeClose;
        next(new Error("test"));
      });
    };

    const options = {
      electrode: { logLevel },
      listener: eventListener
    };

    const intercept = xstdout.intercept(true);

    return asyncVerify(
      expectError(() => electrodeServer(options)),
      error => {
        expect(error.constructor.name).toBe("Error");
        expect(stopped).toBe(true);
        expect(error.code).toBe("XEVENT_FAILED");
      },
      runFinally(() => intercept.restore())
    );
  }, 10_000);

  it("load plugin from the module default field", async () => {
    server = await electrodeServer({
      plugins: {
        test: {
          module: path.join(__dirname, "../plugins/as-default")
        }
      }
    });
    expect(server.hasDecorator("utility")).toBe(true);
    expect((server as any).utility()).toBe("bingo");
  }, 10_000);

  it("load plugin from the module default.fastifyPlugin field", async () => {
    server = await electrodeServer({
      plugins: {
        test: {
          module: path.join(__dirname, "../plugins/as-default-fastify-plugin")
        }
      }
    });
    expect(server.hasDecorator("utility")).toBe(true);
    expect((server as any).utility()).toBe("bingo default.fastifyPlugin");
  }, 10_000);

  it("load plugin from the module fastifyPlugin field", async () => {
    server = await electrodeServer({
      plugins: {
        test: {
          module: path.join(__dirname, "../plugins/as-fastify-plugin")
        }
      }
    });
    expect(server.hasDecorator("utility")).toBe(true);
    expect((server as any).utility()).toBe("bingo fastifyPlugin");
  }, 10_000);

  it("load plugin from the module plugin field", async () => {
    server = await electrodeServer({
      plugins: {
        test: {
          module: path.join(__dirname, "../plugins/as-plugin")
        }
      }
    });
    expect(server.hasDecorator("utility")).toBe(true);
    expect((server as any).utility()).toBe("bingo plugin");
  }, 10_000);

  it("gets a fresh instance of request.app", async () => {
    let marker = 1;
    let saveReq;
    server = await electrodeServer({ deferStart: true });
    server.route({
      method: "GET",
      url: "/",
      handler: (req, reply) => {
        if (!saveReq) {
          saveReq = req;
        }
        reply.send((req as any).app.marker ? "Not Fresh" : "Fresh");
        (req as any).app.marker = marker;
        server.app.marker = marker;
        marker++;
      }
    });
    await server.start();
    const { payload: payload1 } = await server.inject({ method: "GET", url: "/" });
    expect(saveReq.app.marker).toBe(1);
    const { payload: payload2 } = await server.inject({ method: "GET", url: "/" });
    expect(saveReq.app.marker).toBe(1);
    expect(payload1).toBe("Fresh");
    expect(payload2).toBe("Fresh");
  }, 10_000);

  it("gets decorated with request.path", async () => {
    server = await electrodeServer({ deferStart: true });
    server.route({
      method: "GET",
      url: "/some/path",
      handler: (req, reply) => {
        reply.send((req as any).path);
      }
    });
    await server.start();
    const { payload } = await server.inject({ method: "GET", url: "/some/path?query=1" });
    expect(payload).toBe("/some/path");
  }, 10_000);

  it("gets decorated with request.path that is accessible from hooks", async () => {
    server = await electrodeServer({ deferStart: true });
    server.addHook("onRequest", (req, reply, done) => {
      reply.send((req as any).path);
      done();
    });
    await server.inject({ method: "GET", url: "/some/path?query=1" });
    const { payload } = await server.inject({ method: "GET", url: "/some/path?query=1" });
    expect(payload).toBe("/some/path");
  }, 10_000);

  it("gets decorated with request.info.ip (injected request)", async () => {
    server = await electrodeServer({ deferStart: true });
    server.addHook("onRequest", (req, reply, done) => {
      reply.send((req as any).info.remoteAddress);
      done();
    });
    await server.start();
    const resp = await request.get(`http://127.0.0.1:${server.info.port}/path`);
    expect(resp.text).toBe("127.0.0.1");
  }, 10_000);

  it("gets decorated with request.info.ip", async () => {
    server = await electrodeServer({ deferStart: true });
    server.addHook("onRequest", (req, reply, done) => {
      reply.send((req as any).info.remoteAddress);
      done();
    });
    await server.start();
    const { payload } = await server.inject({ method: "GET", url: "/some/path?query=1" });
    expect(payload).toBe("127.0.0.1");
  }, 10_000);
});
