"use strict";

const path = require("path");
const electrodeServer = require("../..");
const assert = require("chai").assert;
const _ = require("lodash");
const request = require("superagent");
const xaa = require("xaa");
const { asyncVerify, expectError, runFinally } = require("run-verify");

const HTTP_404 = 404;

describe("electrode-server", function() {
  const logLevel = "none";

  this.timeout(10000);

  beforeEach(() => {
    process.env.PORT = 3000;
  });

  let server;

  const stopServer = s => s && s.close();

  afterEach(() => {
    delete process.env.PORT;
    const s = server;
    server = undefined;
    return stopServer(s);
  });

  const verifyServer = s => {
    return asyncVerify(
      () => assert(s.app.config, "server.app.config not available"),
      expectError(next => {
        return request.get(`http://127.0.0.1:${s.server.address().port}/html/test.html`).end(next);
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
  });

  it("should support deferStart to allow user to add routes to server", () => {
    return asyncVerify(async () => {
      server = await electrodeServer({ deferStart: true });
      server.route({
        method: "GET",
        path: "/",
        handler: async () => "foo"
      });
      await server.start();
    });
  });

  it("should fail for PORT in use", () => {
    return asyncVerify(
      expectError(async () => {
        server = await electrodeServer();
        await electrodeServer({
          connection: {
            port: server.server.address().port
          },
          electrode: {
            logLevel
          }
        });
      }),
      error => {
        expect(error).to.be.an("Error");
        expect(error.message).includes("is already in use");
      }
    );
  });

  it("should fail for listener errors", () => {
    return asyncVerify(
      expectError(() => electrodeServer({}, require("../decor/decor3"))),
      error => {
        expect(error).to.be.an("Error");
        expect(error.message).includes("test listner error");
      }
    );
  });

  it("should fail for listener errors from decor array with func", () => {
    return asyncVerify(
      expectError(() => electrodeServer({}, [require("../decor/decor4")])),
      error => {
        expect(error).to.be.an("Error");
        expect(error.message).includes("test listner error");
      }
    );
  });

  it("should fail if plugins.requireFromPath is not string", () => {
    const options = { electrode: { logLevel: "none" }, plugins: { requireFromPath: {} } };
    return asyncVerify(
      expectError(() => electrodeServer(options)),
      error => {
        expect(error).to.be.an("Error");
        expect(error.message).contains("config.plugins.requireFromPath must be a string");
      }
    );
  });

  it("should fail if can't load module from requireFromPath", () => {
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
        expect(error).to.be.an("Error");
        expect(error.message).contains("Failed loading module fastify-plugin from path");
        expect(error.message).contains("Cannot find module 'fastify-plugin'");
      }
    );
  });

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
    return asyncVerify(
      expectError(() => electrodeServer(options)),
      error => {
        expect(error).to.be.an("Error");
        expect(error.message).contains("Failed loading module fastify-plugin from path");
        expect(error.message).contains("Cannot find module 'fastify-plugin'");
      }
    );
  });

  it("should start up with @empty_config", async () => {
    server = await electrodeServer();
  });

  it("should start up with @correct_plugins_priority", () => {
    return asyncVerify(
      async () => (server = await electrodeServer(require("../data/server.js"))),
      () => {
        assert.ok(server.testPlugin, "testPlugin missing in server");
        assert.ok(server.es6StylePlugin, "es6StylePlugin missing in server");
      }
    );
  });

  it("should return static file", () => {
    const config = {
      server: {
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

    return asyncVerify(async () => {
      server = await electrodeServer(config, [require("../decor/decor-static-paths")]);
      const resp = await request.get(`http://localhost:${server.server.address().port}/html/hello.html`);
      assert(resp, "Server didn't return response");
      assert(resp.text.includes("Hello Test!"), "response not contain expected string");
    });
  });

  it("should fail for invalid plugin spec", () => {
    const options = {
      electrode: { logLevel: "none" },
      plugins: { invalid: { module: false } }
    };
    return asyncVerify(
      expectError(() => electrodeServer(options)),
      error => {
        expect(error).to.be.an("Error");
        expect(error.message).contains(
          `plugin invalid disable 'module' but has no 'register' field`
        );
      }
    );
  });

  it("should fail start up due to @plugin_error", () => {
    return asyncVerify(
      expectError(() => electrodeServer(require("../data/server-with-plugin-error.js"))),
      error => {
        expect(error).to.be.an("Error");
        expect(error.message).contains(`plugin_failure`);
      }
    );
  });

  it("should fail start up due to @bad_plugin", () => {
    return asyncVerify(
      expectError(
        () => electrodeServer(require("../data/bad-plugin.js")),
        error => {
          expect(error).to.be.an("Error");
          expect(error.message).contains(`Failed loading module ./test/plugins/err-plugin`);
        }
      )
    );
  });

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
    return asyncVerify(
      expectError(() => electrodeServer(options)),
      error => {
        expect(error).to.be.an("Error");
        expect(error.message).includes(
          "plugin 'test' with register function timeout - did you return a resolved promise?"
        );
      }
    );
  });

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
        .then(() => Promise.reject(new Error("boom")));
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
    return asyncVerify(
      runFinally(() => (process.execArgv = save)),
      expectError(() => electrodeServer(options)),
      error => {
        expect(error).to.be.an("Error");
        expect(error.message).includes("--- test timeout ---");
      }
    );
  };

  it("should not abort with plugins register timeout in inspect mode", () => {
    return testNoAbort("--inspect");
  });

  it("should not abort with plugins register timeout in inspect-brk mode", () => {
    return testNoAbort("--inspect-brk");
  });

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
    return asyncVerify(
      expectError(() => electrodeServer(options)),
      error => {
        expect(error).to.be.an("Error");
        expect(error.message).includes("test plugin register returning error");
      }
    );
  });

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

    return asyncVerify(
      expectError(() => electrodeServer(options)),
      error => {
        expect(error).to.be.an("Error");
        expect(error.message).includes("fail-plugin");
        expect(error.code).eq("XPLUGIN_FAILED");
        expect(error.method).includes("with module");
      }
    );
  });

  it("should fail plugin with string instead of error", async () => {
    const options = {
      plugins: {
        test: {
          module: path.join(__dirname, "../plugins/fail-plugin-with-message")
        }
      }
    };
    return asyncVerify(
      expectError(() => electrodeServer(options)),
      error => {
        expect(error).to.be.an("Error");
        expect(error.message).includes("fail-plugin");
        expect(error.code).eq("XPLUGIN_FAILED");
        expect(error.method).includes("with module");
      }
    );
  });

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
    return asyncVerify(
      expectError(() => electrodeServer(options)),
      error => {
        expect(error).to.be.an("Error");
        expect(error.message).includes("fail-plugin");
      }
    );
  });

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
    return asyncVerify(
      expectError(() => electrodeServer(options)),
      error => {
        expect(error).to.be.an("Error");
        expect(error.message).includes("test plugin failure");
      }
    );
  });

  it("should load default config when no environment specified", async () => {
    server = await electrodeServer();
    assert.equal(server.app.config.electrode.source, "development");
  });

  it("should load config based on environment", async () => {
    process.env.NODE_ENV = "production";

    try {
      server = await electrodeServer();
      assert.equal(server.app.config.electrode.source, "production");
    } finally {
      process.env.NODE_ENV = "test";
    }
  });

  it("should skip env config that doesn't exist", async () => {
    process.env.NODE_ENV = "development";

    try {
      server = await electrodeServer();
      assert.equal(server.app.config.electrode.source, "development");
    } finally {
      process.env.NODE_ENV = "test";
    }
  });

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

    server = await electrodeServer(options);
    assert(firedEvents.indexOf(false) === -1, "failed to fire event.");
  });

  it("should handle event handler timeout error", () => {
    const eventListener = emitter => {
      emitter.on("plugins-sorted", (data, next) => {}); // eslint-disable-line
    };

    const options = {
      electrode: { logLevel, eventTimeout: 20 },
      listener: eventListener
    };

    return asyncVerify(
      expectError(() => electrodeServer(options)),
      error => {
        expect(error).to.be.an("Error");
        expect(error.code).to.equal("XEVENT_TIMEOUT");
      }
    );
  });

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

    return asyncVerify(
      expectError(() => electrodeServer(options)),
      error => {
        expect(error).to.be.an("Error");
        expect(error.code).to.equal("XEVENT_FAILED");
      }
    );
  });

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
        server._close = server.close;
        server.close = fakeClose;
        next(new Error("test"));
      });
    };

    const options = {
      electrode: { logLevel },
      listener: eventListener
    };

    return asyncVerify(
      expectError(() => electrodeServer(options)),
      error => {
        expect(error).to.be.an("Error");
        expect(stopped).to.equal(true);
        expect(error.code).to.equal("XEVENT_FAILED");
      }
    );
  });

  it("test fastify plugin", async () => {
    server = await electrodeServer({
      plugins: {
        test: {
          module: path.join(__dirname, "../plugins/fastify-plugin")
        }
      }
    });
    expect(server.hasDecorator("utility")).true;
    expect(server.utility()).eq("bingo");
  });

  it("gets a fresh instance of request.app", async () => {
    server = await electrodeServer({ deferStart: true });
    server.route({
      method: "GET",
      path: "/",
      handler: (req, reply) => {
        reply.send(req.app.marker ? "Not Fresh" : "Fresh");
        req.app.marker = 1;
        server.app.marker = 1;
      }
    });
    await server.start();
    const { payload: payload1 } = await server.inject({ method: "GET", url: "/" });
    const { payload: payload2 } = await server.inject({ method: "GET", url: "/" });
    expect(payload1).to.equal("Fresh");
    expect(payload2).to.equal("Fresh");
  });

  it("gets decorated with request.path", async () => {
    server = await electrodeServer({ deferStart: true });
    server.route({
      method: "GET",
      path: "/some/path",
      handler: (req, reply) => {
        reply.send(req.path);
      }
    });
    await server.start();
    const {payload} = await server.inject({ method: "GET", url: "/some/path?query=1"});
    expect(payload).to.equal("/some/path");
  });

  it("gets decorated with request.path that is accessible from hooks", async () => {
    server = await electrodeServer({ deferStart: true });
    server.addHook("onRequest", (req, reply, done) => {
      reply.send(req.path);
      done();
    });
    await server.inject({ method: "GET", url: "/some/path?query=1"});
    const {payload} = await server.inject({ method: "GET", url: "/some/path?query=1"});
    expect(payload).to.equal("/some/path");
  });

  it("gets decorated with request.info.ip (injected request)", async () => {
    server = await electrodeServer({ deferStart: true });
    server.addHook("onRequest", (req, reply, done) => {
      reply.send(req.info.remoteAddress);
      done();
    });
    await server.start();
    const resp = await request.get(`http://localhost:${server.server.address().port}/path`);
    expect(resp.text).to.equal("127.0.0.1");
  });

  it("gets decorated with request.info.ip", async () => {
    server = await electrodeServer({ deferStart: true });
    server.addHook("onRequest", (req, reply, done) => {
      reply.send(req.info.remoteAddress);
      done();
    });
    await server.start();
    const {payload} = await server.inject({ method: "GET", url: "/some/path?query=1"});
    expect(payload).to.equal("127.0.0.1");
  });
});
