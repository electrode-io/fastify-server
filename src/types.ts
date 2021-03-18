import { FastifyInstance, ServerOptions } from "fastify";

export type ServerInfo = {
  address: string;
  port: number;
};
export interface ElectrodeFastifyInstance extends FastifyInstance {
  info: ServerInfo;
  start: () => Promise<any>;
  app: { config: any } & Record<string, any>;
  /**
   * FastifyInstance doesn't type initialConfig
   *
   */
  initialConfig: {
    connectionTimeout: number;
    requestIdHeader: string;
    requestIdLogLabel: string;
    disableRequestLogging: boolean;
    bodyLimit: number;
    caseSensitive: boolean;
    ignoreTrailingSlash: boolean;
    maxParamLength: number;
    onProtoPoisoning: string;
    onConstructorPoisoning: string;
    pluginTimeout: number;
    http2SessionTimeout: number;
  };
}

/**
 * Specify a plugin to register for fastify
 */
export type PluginOptions = {
  /**
   * determine the order this plugin gets register, lower the value, earlier it's register
   */
  priority?: number;

  /**
   * Set to `false` to disable this plugin
   *
   * - **Default**: `true`
   * - useful for multi env config composition to disable a plugin for certain env
   */
  enable?: boolean;

  /**
   * The path as the origin dir to call require to load the module for this plugin
   */
  requireFromPath?: string;

  /**
   * name/path of the module to load the plugin's register
   *
   * - If this is not set, then use the field name of this plugin within plugin config
   *   as the module name.
   */
  module?: string;

  /**
   * Use this to specify the plugin's register function directly
   *
   * - If this is set, then `module` field is ignored.
   */
  register?: any;

  /**
   * options that will be passed to the plugin's register function
   */
  options?: any;
};

/**
 * Plugins config for specifying plugins that will register with fastify
 */
export type PluginsConfig =
  | Record<string, PluginOptions>
  | {
      /**
       * The path as the origin dir to call require to load any plugin modules.
       * - Note: this means you would not be able to specify a plugin with this key.
       */
      requireFromPath?: string;
    };

/**
 * Connection params for fastify
 */
export type ConnectionConfig = {
  /** hostname for server */
  host?: string;
  /** IP address to listen on. **Default**: `"0.0.0.0"` */
  address?: string;
  /** port number to listen on */
  port?: number;
};

/**
 * settings specific to Electrode's add-ons for the fastify server
 */
export type ElectrodeOptions = {
  /** timeout in milliseconds to wait for events such as register plugins */
  eventTimeout?: number;
};

/**
 * Config for starting a fastify server with Electrode add-ons
 */
export type ElectrodeServerConfig = {
  /** if `true` then don't call start on the fastify server so user code can add routes and call start after */
  deferStart?: boolean;
  /** specify connection params for fastify */
  connection?: ConnectionConfig;
  /**
   * specify plugins that will register with fastify
   *
   * - normally, specifying a simple plugin can be done simply as:
   *
   * ```js
   * {
   *   requireFromPath: __dirname,
   *   "./plugins/demo-plugin": {}
   * }
   * ```
   */
  plugins?: PluginsConfig;
  /** options to be passed to fastify verbatim */
  server?: ServerOptions;
  /** settings specific to Electrode's add-ons for the fastify server */
  electrode?: ElectrodeOptions;
};
