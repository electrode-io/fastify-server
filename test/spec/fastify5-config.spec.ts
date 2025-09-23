// Test to verify Fastify 5 configuration compatibility
import { electrodeServer } from "../../src/electrode-server";
import { ElectrodeFastifyInstance } from "../../src/types";

describe("Fastify 5 Configuration Compatibility", () => {
  let server: ElectrodeFastifyInstance | undefined;

  afterEach(async () => {
    if (server) {
      await server.close();
      server = undefined;
    }
  });

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

    expect(server.version).toBe("5.6.1");
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
          register: async (fastify) => {
            fastify.get("/test-req-id", async (request) => {
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

    expect(server.version).toBe("5.6.1");
    await server.start();
  });
});
