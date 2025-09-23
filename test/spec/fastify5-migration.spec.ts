import { electrodeServer } from "../../src/electrode-server";
import { ElectrodeFastifyInstance } from "../../src/types";

describe("Fastify 5 Migration", () => {
  let server: ElectrodeFastifyInstance | undefined;

  afterEach(async () => {
    if (server) {
      await server.close();
      server = undefined;
    }
  });

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
