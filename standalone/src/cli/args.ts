/**
 * CLI argument parser
 */

import minimist from 'minimist';

export interface CliArgs {
  port: number;
  host: string;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  providers: string[];
  config: string;
  help: boolean;
  version: boolean;
  apiKey?: string;
  copilotToken?: string;
  geminiApiKey?: string;
}

const DEFAULT_PORT = 1337;
const DEFAULT_HOST = '127.0.0.1';
const DEFAULT_LOG_LEVEL = 'info';
const DEFAULT_CONFIG = '~/.oauth2apilocal/config.json';

export function parseArgs(argv: string[] = process.argv.slice(2)): CliArgs {
  const args = minimist(argv, {
    string: ['host', 'log-level', 'providers', 'config', 'api-key', 'copilot-token', 'gemini-api-key'],
    boolean: ['help', 'version'],
    alias: {
      p: 'port',
      h: 'host',
      l: 'log-level',
      c: 'config',
      '?': 'help',
      v: 'version',
    },
    default: {
      port: DEFAULT_PORT,
      host: DEFAULT_HOST,
      'log-level': DEFAULT_LOG_LEVEL,
      config: DEFAULT_CONFIG,
      providers: 'copilot,gemini',
    },
  });

  return {
    port: Number(args.port) || DEFAULT_PORT,
    host: args.host,
    logLevel: args['log-level'] as CliArgs['logLevel'],
    providers: args.providers.split(',').map((p: string) => p.trim()),
    config: args.config,
    help: args.help,
    version: args.version,
    apiKey: args['api-key'],
    copilotToken: args['copilot-token'],
    geminiApiKey: args['gemini-api-key'],
  };
}

export function printHelp(): void {
  console.log(`
OAuth2APIlocal - Standalone API Gateway

USAGE:
  oauth2apilocal [OPTIONS]

OPTIONS:
  -p, --port <number>          Port to listen on (default: ${DEFAULT_PORT})
  -h, --host <string>          Host interface (default: ${DEFAULT_HOST})
  -l, --log-level <level>      Log level: debug, info, warn, error (default: ${DEFAULT_LOG_LEVEL})
  -c, --config <path>          Path to config file (default: ${DEFAULT_CONFIG})
  --providers <list>           Comma-separated provider list (default: copilot,gemini)
  --api-key <key>              API key for authentication
  --copilot-token <token>      GitHub Copilot OAuth2 token
  --gemini-api-key <key>       Google Gemini API key
  --help, -?                   Show this help message
  --version, -v                Show version

ENVIRONMENT VARIABLES:
  GEMINI_API_KEY               Google Gemini API key (alternative to --gemini-api-key)
  GOOGLE_CLIENT_ID             Google OAuth2 client ID
  GOOGLE_CLIENT_SECRET         Google OAuth2 client secret
  GITHUB_TOKEN                 GitHub personal access token

EXAMPLES:
  # Start with default settings
  oauth2apilocal

  # Custom port and host
  oauth2apilocal --port 8080 --host 0.0.0.0

  # Enable only Gemini provider
  oauth2apilocal --providers gemini --gemini-api-key YOUR_KEY

  # Debug mode
  oauth2apilocal --log-level debug

For more information, visit: https://github.com/digitalsorc/Oauth2APIlocal
  `);
}

export function printVersion(): void {
  // Read version from package.json at runtime
  console.log('oauth2apilocal v1.0.0');
}
