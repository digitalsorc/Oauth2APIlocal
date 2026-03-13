/**
 * Configuration manager for ~/.oauth2apilocal/config.json
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { getLogger } from '../utils/logger';

export interface Config {
  port: number;
  host: string;
  apiKey?: string;
  providers: {
    copilot?: {
      enabled: boolean;
      token?: string;
      refreshToken?: string;
      expiresAt?: number;
    };
    gemini?: {
      enabled: boolean;
      apiKey?: string;
      token?: string;
      refreshToken?: string;
      expiresAt?: number;
    };
  };
  preferences: {
    defaultProvider: string;
    logLevel: string;
    enableLogging: boolean;
  };
}

export class ConfigManager {
  private configPath: string;
  private config: Config;

  constructor(configPath?: string) {
    // Expand ~ to home directory
    if (configPath?.startsWith('~')) {
      configPath = path.join(os.homedir(), configPath.slice(1));
    }

    this.configPath = configPath || path.join(os.homedir(), '.oauth2apilocal', 'config.json');
    this.config = this.loadConfig();
  }

  private ensureConfigDir(): void {
    const configDir = path.dirname(this.configPath);
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
      getLogger().info(`Created config directory: ${configDir}`);
    }
  }

  private loadConfig(): Config {
    this.ensureConfigDir();

    if (!fs.existsSync(this.configPath)) {
      getLogger().info(`Config file not found, creating default: ${this.configPath}`);
      return this.getDefaultConfig();
    }

    try {
      const data = fs.readFileSync(this.configPath, 'utf-8');
      const config = JSON.parse(data);
      getLogger().debug(`Loaded config from ${this.configPath}`);
      return config;
    } catch (error) {
      getLogger().error(`Failed to load config from ${this.configPath}`, error as Error);
      return this.getDefaultConfig();
    }
  }

  private getDefaultConfig(): Config {
    return {
      port: 1337,
      host: '127.0.0.1',
      providers: {
        copilot: {
          enabled: true,
        },
        gemini: {
          enabled: true,
        },
      },
      preferences: {
        defaultProvider: 'copilot',
        logLevel: 'info',
        enableLogging: true,
      },
    };
  }

  getConfig(): Config {
    return { ...this.config };
  }

  updateConfig(updates: Partial<Config>): void {
    this.config = { ...this.config, ...updates };
    this.saveConfig();
  }

  updateProviderConfig(provider: 'copilot' | 'gemini', updates: Partial<Config['providers']['copilot']>): void {
    if (!this.config.providers[provider]) {
      this.config.providers[provider] = { enabled: true };
    }
    this.config.providers[provider] = { ...this.config.providers[provider], ...updates };
    this.saveConfig();
  }

  saveConfig(): void {
    this.ensureConfigDir();

    try {
      fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2), 'utf-8');
      getLogger().debug(`Saved config to ${this.configPath}`);
    } catch (error) {
      getLogger().error(`Failed to save config to ${this.configPath}`, error as Error);
    }
  }

  // Token management helpers
  saveCopilotToken(token: string, refreshToken?: string, expiresAt?: number): void {
    this.updateProviderConfig('copilot', {
      token,
      refreshToken,
      expiresAt,
    });
  }

  saveGeminiToken(apiKey: string): void {
    this.updateProviderConfig('gemini', {
      apiKey,
    });
  }

  getCopilotToken(): string | undefined {
    return this.config.providers.copilot?.token;
  }

  getGeminiApiKey(): string | undefined {
    return this.config.providers.gemini?.apiKey;
  }
}
