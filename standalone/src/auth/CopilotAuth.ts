/**
 * GitHub Copilot OAuth2 authentication
 * ASSUMPTION: GitHub Copilot tokens can be obtained via GitHub OAuth2 flow
 * For standalone use, users should provide tokens via environment variables or config
 */

import { getLogger } from '../utils/logger';

export interface CopilotAuthConfig {
  token?: string;
  refreshToken?: string;
  expiresAt?: number;
}

export class CopilotAuth {
  private token?: string;
  private refreshToken?: string;
  private expiresAt?: number;

  constructor(config: CopilotAuthConfig = {}) {
    this.token = config.token || process.env.GITHUB_TOKEN;
    this.refreshToken = config.refreshToken;
    this.expiresAt = config.expiresAt;

    if (!this.token) {
      getLogger().warn('No GitHub Copilot token provided. Set GITHUB_TOKEN environment variable or provide via config.');
    }
  }

  getToken(): string | undefined {
    // ASSUMPTION: In standalone mode, we expect users to provide long-lived tokens
    // In VS Code extension, tokens are managed by the Copilot extension
    if (this.isTokenExpired()) {
      getLogger().warn('GitHub token is expired. Please refresh your token.');
      return undefined;
    }
    return this.token;
  }

  setToken(token: string, refreshToken?: string, expiresAt?: number): void {
    this.token = token;
    this.refreshToken = refreshToken;
    this.expiresAt = expiresAt;
    getLogger().info('GitHub Copilot token updated');
  }

  private isTokenExpired(): boolean {
    if (!this.expiresAt) {
      // No expiration set, assume token is valid
      return false;
    }
    return Date.now() >= this.expiresAt;
  }

  async refreshAccessToken(): Promise<boolean> {
    // ASSUMPTION: Token refresh requires GitHub OAuth2 client credentials
    // For now, we expect users to manually refresh tokens
    // TODO: Implement GitHub OAuth2 refresh flow if client credentials are available
    if (!this.refreshToken) {
      getLogger().warn('No refresh token available. Cannot refresh access token.');
      return false;
    }

    getLogger().warn('Token refresh not yet implemented in standalone mode. Please manually update your token.');
    return false;
  }

  isAuthenticated(): boolean {
    return !!this.token && !this.isTokenExpired();
  }
}
