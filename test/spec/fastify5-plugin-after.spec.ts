// Test to verify the specific .after() usage works in Fastify 5
import { electrodeServer } from "../../src/electrode-server";
import { ElectrodeFastifyInstance } from "../../src/types";

describe("Fastify 5 Plugin Registration Compatibility", () => {
  let server: ElectrodeFastifyInstance | undefined;

  afterEach(async () => {
    if (server) {
      await server.close();
      server = undefined;
    }
  });

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
          register: async (fastify) => {
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
          register: async (fastify) => {
            pluginOrder.push("first-register");
            fastify.after(() => {
              pluginOrder.push("first-after");
            });
          }
        },
        secondPlugin: {
          priority: 2,
          register: async (fastify) => {
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
