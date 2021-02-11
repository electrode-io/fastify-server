import { FastifyServerOptions } from "fastify";

export interface config {
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
