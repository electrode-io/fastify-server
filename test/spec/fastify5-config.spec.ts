// Test to verify Fastify 5 configuration and plugin compatibility
import { electrodeServer } from "../../src/electrode-server";
import { ElectrodeFastifyInstance } from "../../src/types";

describe("Fastify 5 Compatibility", () => {
  let server: ElectrodeFastifyInstance | undefined;

  afterEach(async () => {
    if (server) {
      await server.close();
      server = undefined;
    }
  });

  describe("Migration Verification", () => {
    it("should use Fastify 5.x", async () => {
      server = await electrodeServer({
        deferStart: true,
        connection: {
          port: 0 // Use random port
        },
        plugins: {}
      });

      expect(server.version).toMatch(/^5\./);
      expect(server.version).toBe("5.6.1");
    });

    it("should work with Fastify 5 plugin system", async () => {
      const pluginCalled = jest.fn();

      server = await electrodeServer({
        deferStart: true,
        connection: {
          port: 0
        },
        plugins: {
          testPlugin: {
            register: async fastify => {
              pluginCalled();
              fastify.get("/test-plugin", async () => {
                return { message: "Plugin working with Fastify 5" };
              });
            }
          }
        }
      });

      await server.start();

      expect(pluginCalled).toHaveBeenCalled();

      const response = await server.inject({
        method: "GET",
        url: "/test-plugin"
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toEqual({
        message: "Plugin working with Fastify 5"
      });
    });

    it("should handle Node.js 20+ features", async () => {
      // Verify we're running on Node 20+
      const nodeVersion = process.version;
      const majorVersion = parseInt(nodeVersion.split(".")[0].substring(1), 10);
      expect(majorVersion).toBeGreaterThanOrEqual(20);

      server = await electrodeServer({
        deferStart: true,
        connection: {
          port: 0
        },
        plugins: {}
      });

      // Test that the server starts and works properly
      await server.start();
      expect(server.info.port).toBeGreaterThan(0);
    });

    it("should maintain compatibility with existing decorator patterns", async () => {
      server = await electrodeServer({
        deferStart: true,
        connection: {
          port: 0
        },
        plugins: {}
      });

      // Test that all the custom decorators still work
      expect(server.app).toBeDefined();
      expect(server.app.config).toBeDefined();
      expect(server.info).toBeDefined();
      expect(server.start).toBeDefined();
      expect(typeof server.start).toBe("function");
    });
  });

  describe("Configuration Compatibility", () => {
    it("should handle all common FastifyServerOptions with Fastify 5", async () => {
      server = await electrodeServer({
        deferStart: true,
        connection: {
          port: 0
        },
        server: {
          // Test common Fastify server options that might have changed
          logger: false,
          disableRequestLogging: true,
          bodyLimit: 1048576,
          connectionTimeout: 0,
          keepAliveTimeout: 72000,
          forceCloseConnections: false,
          requestIdHeader: false, // This changed default in Fastify 5
          requestIdLogLabel: "reqId",
          http2: false,
          https: false,
          maxRequestsPerSocket: 0,
          requestTimeout: 0,
          pluginTimeout: 10000,
          trustProxy: false,
          // Router options should be under routerOptions in newer versions
          routerOptions: {
            maxParamLength: 1000,
            ignoreTrailingSlash: false,
            ignoreDuplicateSlashes: false,
            caseSensitive: true,
            allowUnsafeRegex: false
          }
        }
      });

      expect(server.version).toMatch(/^5\./);
      await server.start();
      expect(server.info.port).toBeGreaterThan(0);
    });

    it("should handle logger configuration with Fastify 5", async () => {
      server = await electrodeServer({
        deferStart: true,
        connection: {
          port: 0
        },
        server: {
          logger: {
            level: "warn",
            serializers: {
              req: false,
              res: false
            }
          }
        }
      });

      expect(server.version).toMatch(/^5\./);
      await server.start();
    });

    it("should work with requestIdHeader set to false (Fastify 5 default)", async () => {
      server = await electrodeServer({
        deferStart: true,
        connection: {
          port: 0
        },
        server: {
          requestIdHeader: false // This is now the default in Fastify 5
        }
      });

      await server.start();

      const response = await server.inject({
        method: "GET",
        url: "/non-existent-route"
      });

      // Should not have a request-id header by default
      expect(response.headers["request-id"]).toBeUndefined();
    });

    it("should still work with requestIdHeader enabled", async () => {
      server = await electrodeServer({
        deferStart: true,
        connection: {
          port: 0
        },
        server: {
          requestIdHeader: "x-request-id"
        },
        plugins: {
          testRoute: {
            register: async fastify => {
              fastify.get("/test-req-id", async request => {
                return { requestId: request.id };
              });
            }
          }
        }
      });

      await server.start();

      const response = await server.inject({
        method: "GET",
        url: "/test-req-id"
      });

      // Check that the request ID was generated and returned
      const body = JSON.parse(response.body);
      expect(body.requestId).toBeDefined();
      expect(typeof body.requestId).toBe("string");
    });

    it("should handle new Fastify 5 options if any", async () => {
      server = await electrodeServer({
        deferStart: true,
        connection: {
          port: 0
        },
        server: {
          // Any new Fastify 5 specific options would go here
          // Currently testing that it doesn't break with standard options
          jsonShorthand: true,
          ajv: {
            customOptions: {
              coerceTypes: "array"
            }
          }
        }
      });

      expect(server.version).toMatch(/^5\./);
      await server.start();
    });
  });

  describe("Plugin Registration Compatibility", () => {
    it("should handle plugin registration with .after() pattern in Fastify 5", async () => {
      let pluginExecuted = false;
      let afterExecuted = false;

      server = await electrodeServer({
        deferStart: true,
        connection: {
          port: 0
        },
        plugins: {
          testPlugin: {
            register: async fastify => {
              pluginExecuted = true;

              // Add a simple route to verify the plugin works
              fastify.get("/test-after", async () => {
                return { message: "Plugin with .after() works in Fastify 5" };
              });

              // Test that we can use .after() functionality
              fastify.after(() => {
                afterExecuted = true;
              });
            },
            options: {}
          }
        }
      });

      expect(pluginExecuted).toBe(true);

      await server.start();

      // Test the route works
      const response = await server.inject({
        method: "GET",
        url: "/test-after"
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toEqual({
        message: "Plugin with .after() works in Fastify 5"
      });

      // Verify .after() was called
      expect(afterExecuted).toBe(true);
    });

    it("should handle multiple plugins with .after() callbacks", async () => {
      const pluginOrder: string[] = [];

      server = await electrodeServer({
        deferStart: true,
        connection: {
          port: 0
        },
        plugins: {
          firstPlugin: {
            priority: 1,
            register: async fastify => {
              pluginOrder.push("first-register");
              fastify.after(() => {
                pluginOrder.push("first-after");
              });
            }
          },
          secondPlugin: {
            priority: 2,
            register: async fastify => {
              pluginOrder.push("second-register");
              fastify.after(() => {
                pluginOrder.push("second-after");
              });
            }
          }
        }
      });

      await server.start();

      // Verify the execution order
      expect(pluginOrder).toContain("first-register");
      expect(pluginOrder).toContain("second-register");
      expect(pluginOrder).toContain("first-after");
      expect(pluginOrder).toContain("second-after");
    });
  });
});
