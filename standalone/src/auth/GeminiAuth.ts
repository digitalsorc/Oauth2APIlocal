/**
 * Google Gemini authentication (API key or OAuth2)
 */

import { getLogger } from '../utils/logger';

export interface GeminiAuthConfig {
  apiKey?: string;
  clientId?: string;
  clientSecret?: string;
  token?: string;
  refreshToken?: string;
  expiresAt?: number;
}

export class GeminiAuth {
  private apiKey?: string;
  private clientId?: string;
  private clientSecret?: string;
  private token?: string;
  private refreshToken?: string;
  private expiresAt?: number;

  constructor(config: GeminiAuthConfig = {}) {
    this.apiKey = config.apiKey || process.env.GEMINI_API_KEY;
    this.clientId = config.clientId || process.env.GOOGLE_CLIENT_ID;
    this.clientSecret = config.clientSecret || process.env.GOOGLE_CLIENT_SECRET;
    this.token = config.token;
    this.refreshToken = config.refreshToken;
    this.expiresAt = config.expiresAt;

    if (!this.apiKey && !this.token) {
      getLogger().warn('No Gemini API key or OAuth2 token provided. Set GEMINI_API_KEY environment variable or provide via config.');
    }
  }

  /**
   * Get authentication credential (API key or OAuth2 token)
   */
  getAuthCredential(): string | undefined {
    // Prefer API key for simplicity
    if (this.apiKey) {
      return this.apiKey;
    }

    // Fall back to OAuth2 token
    if (this.token && !this.isTokenExpired()) {
      return this.token;
    }

    return undefined;
  }

  setApiKey(apiKey: string): void {
    this.apiKey = apiKey;
    getLogger().info('Gemini API key updated');
  }

  setOAuth2Token(token: string, refreshToken?: string, expiresAt?: number): void {
    this.token = token;
    this.refreshToken = refreshToken;
    this.expiresAt = expiresAt;
    getLogger().info('Gemini OAuth2 token updated');
  }

  private isTokenExpired(): boolean {
    if (!this.expiresAt) {
      return false;
    }
    return Date.now() >= this.expiresAt;
  }

  async refreshAccessToken(): Promise<boolean> {
    // ASSUMPTION: OAuth2 token refresh requires Google OAuth2 client credentials
    // For now, API key auth is preferred for standalone usage
    // TODO: Implement Google OAuth2 refresh flow if needed
    if (!this.refreshToken || !this.clientId || !this.clientSecret) {
      getLogger().warn('Cannot refresh Gemini token: missing refresh token or client credentials');
      return false;
    }

    getLogger().warn('OAuth2 token refresh not yet implemented. Use API key authentication instead.');
    return false;
  }

  isAuthenticated(): boolean {
    return !!(this.apiKey || (this.token && !this.isTokenExpired()));
  }

  usesApiKey(): boolean {
    return !!this.apiKey;
  }

  usesOAuth2(): boolean {
    return !!this.token && !this.apiKey;
  }
}
