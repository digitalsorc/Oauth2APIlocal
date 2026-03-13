#!/usr/bin/env node
/**
 * OAuth2APIlocal - Standalone Entry Point
 * Cross-platform executable for GitHub Copilot and Gemini Pro API Gateway
 */

import { parseArgs, printHelp, printVersion } from './cli/args';
import { ConfigManager } from './config/ConfigManager';
import { Logger, LogLevel, getLogger, setLogger } from './utils/logger';
import { CopilotAuth } from './auth/CopilotAuth';
import { GeminiAuth } from './auth/GeminiAuth';
import { CopilotProvider } from './gateway/CopilotProvider';
import { GeminiProvider } from './gateway/GeminiProvider';
import { ProviderRouter } from './gateway/ProviderRouter';
import { LocalServer } from './gateway/LocalServer';

class Application {
  private server: LocalServer | null = null;
  private configManager: ConfigManager | null = null;

  async main(): Promise<void> {
    // Parse CLI args
    const args = parseArgs();

    if (args.help) {
      printHelp();
      process.exit(0);
    }

    if (args.version) {
      printVersion();
      process.exit(0);
    }

    // Setup logger
    const logLevel = this.parseLogLevel(args.logLevel);
    setLogger(new Logger({ level: logLevel, enableColors: true }));

    getLogger().info('OAuth2APIlocal starting...');

    // Load configuration
    this.configManager = new ConfigManager(args.config);
    const config = this.configManager.getConfig();

    // Merge CLI args with config
    const port = args.port || config.port;
    const host = args.host || config.host;
    const apiKey = args.apiKey || config.apiKey;

    getLogger().info(`Configuration loaded from ${args.config}`);

    // Initialize authentication
    const copilotToken = args.copilotToken || this.configManager.getCopilotToken();
    const geminiApiKey = args.geminiApiKey || this.configManager.getGeminiApiKey();

    const copilotAuth = new CopilotAuth({ token: copilotToken });
    const geminiAuth = new GeminiAuth({ apiKey: geminiApiKey });

    // Initialize providers
    const router = new ProviderRouter();

    if (args.providers.includes('copilot') && config.providers.copilot?.enabled !== false) {
      const copilotProvider = new CopilotProvider(copilotAuth);
      router.registerProvider(copilotProvider);
      getLogger().info('Copilot provider registered');
    }

    if (args.providers.includes('gemini') && config.providers.gemini?.enabled !== false) {
      const geminiProvider = new GeminiProvider(geminiAuth);
      router.registerProvider(geminiProvider);
      getLogger().info('Gemini provider registered');
    }

    // Create server
    this.server = new LocalServer(
      {
        host,
        port,
        apiKey,
        enableHttps: false, // Default to HTTP for standalone
        rateLimitPerMinute: 60,
        requestTimeoutSeconds: 180,
        maxPayloadSizeMb: 10,
      },
      router
    );

    // Setup graceful shutdown
    this.setupShutdownHandlers();

    // Start server
    try {
      await this.server.start();
      getLogger().info(`Server started successfully on ${host}:${port}`);
      getLogger().info(`API endpoint: http://${host}:${port}/v1/chat/completions`);
      getLogger().info(`Health check: http://${host}:${port}/health`);
      getLogger().info('Press Ctrl+C to stop');

      // Keep process alive
      await new Promise(() => {});
    } catch (error) {
      getLogger().error('Failed to start server', error as Error);
      process.exit(1);
    }
  }

  private parseLogLevel(level: string): LogLevel {
    switch (level.toLowerCase()) {
      case 'debug':
        return LogLevel.DEBUG;
      case 'info':
        return LogLevel.INFO;
      case 'warn':
        return LogLevel.WARN;
      case 'error':
        return LogLevel.ERROR;
      default:
        return LogLevel.INFO;
    }
  }

  private setupShutdownHandlers(): void {
    const shutdown = async (signal: string) => {
      getLogger().info(`Received ${signal}, shutting down gracefully...`);

      if (this.server) {
        await this.server.stop();
      }

      // Flush config
      if (this.configManager) {
        this.configManager.saveConfig();
        getLogger().info('Configuration saved');
      }

      getLogger().info('Goodbye!');
      process.exit(0);
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));

    // Handle uncaught errors
    process.on('uncaughtException', (error) => {
      getLogger().error('Uncaught exception', error);
      process.exit(1);
    });

    process.on('unhandledRejection', (reason) => {
      getLogger().error('Unhandled rejection', reason as Error);
      process.exit(1);
    });
  }
}

// Run application
const app = new Application();
app.main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
