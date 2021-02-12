import { FastifyServerOptions } from "fastify";

interface _Config {
  server?: FastifyServerOptions;
  plugins?: any[];
  connection?: {
    port?: string;
  };
  electrode?: {
    eventTimeout?: number;
  };
  deferStart?: boolean;
  keepAliveTimeout?: number;
}

export type Config = _Config;
