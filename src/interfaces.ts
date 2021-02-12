import { FastifyServerOptions } from "fastify";

export interface Config {
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
