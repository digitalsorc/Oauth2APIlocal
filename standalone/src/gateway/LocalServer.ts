/**
 * LocalServer - HTTP server for the standalone gateway
 * Extracted from CopilotApiGateway, removing all VS Code dependencies
 */

import { createServer, type IncomingMessage, type ServerResponse, type Server } from 'http';
import { createServer as createHttpsServer } from 'https';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { getLogger } from '../utils/logger';
import { ProviderRouter } from './ProviderRouter';
import type { ChatCompletionRequest } from './Provider';

interface ServerConfig {
  host: string;
  port: number;
  apiKey?: string;
  enableHttps: boolean;
  tlsCertPath?: string;
  tlsKeyPath?: string;
  rateLimitPerMinute: number;
  requestTimeoutSeconds: number;
  maxPayloadSizeMb: number;
}

export class LocalServer {
  private server: Server | null = null;
  private config: ServerConfig;
  private router: ProviderRouter;
  private rateLimitBucket: number[] = [];
  private isShuttingDown = false;

  constructor(config: ServerConfig, router: ProviderRouter) {
    this.config = config;
    this.router = router;
  }

  async start(): Promise<void> {
    if (this.server) {
      getLogger().warn('Server already running');
      return;
    }

    const requestHandler = this.createRequestHandler();

    // Create HTTP or HTTPS server
    if (this.config.enableHttps) {
      const tlsOptions = await this.loadTlsOptions();
      this.server = createHttpsServer(tlsOptions, requestHandler);
      getLogger().info('HTTPS server enabled');
    } else {
      this.server = createServer(requestHandler);
    }

    this.server.on('error', (error) => {
      getLogger().error('Server error', error);
    });

    await new Promise<void>((resolve, reject) => {
      const onError = (error: Error) => {
        this.server?.off('error', onError);
        reject(error);
      };
      this.server?.once('error', onError);
      this.server?.listen(this.config.port, this.config.host, () => {
        this.server?.off('error', onError);
        resolve();
      });
    });

    const protocol = this.config.enableHttps ? 'https' : 'http';
    getLogger().info(`Server listening on ${protocol}://${this.config.host}:${this.config.port}`);
  }

  async stop(): Promise<void> {
    if (!this.server) {
      return;
    }

    this.isShuttingDown = true;
    getLogger().info('Stopping server...');

    await new Promise<void>((resolve) => {
      this.server?.close(() => {
        getLogger().info('Server stopped');
        resolve();
      });
    });

    this.server = null;
    this.isShuttingDown = false;
  }

  private async loadTlsOptions(): Promise<{ cert: Buffer | string; key: Buffer | string }> {
    // Check if user provided cert paths
    if (this.config.tlsCertPath && this.config.tlsKeyPath) {
      const certPath = this.config.tlsCertPath.startsWith('~')
        ? path.join(os.homedir(), this.config.tlsCertPath.slice(1))
        : this.config.tlsCertPath;
      const keyPath = this.config.tlsKeyPath.startsWith('~')
        ? path.join(os.homedir(), this.config.tlsKeyPath.slice(1))
        : this.config.tlsKeyPath;

      if (fs.existsSync(certPath) && fs.existsSync(keyPath)) {
        return {
          cert: fs.readFileSync(certPath),
          key: fs.readFileSync(keyPath),
        };
      }
    }

    // Auto-generate self-signed cert
    const selfsigned = require('selfsigned');
    const attrs = [{ name: 'commonName', value: 'localhost' }];
    const pems = selfsigned.generate(attrs, {
      days: 365,
      keySize: 2048,
      algorithm: 'sha256',
    });

    getLogger().info('Using auto-generated self-signed certificate (365 days)');

    return {
      cert: pems.cert,
      key: pems.private,
    };
  }

  private createRequestHandler() {
    return async (req: IncomingMessage, res: ServerResponse) => {
      const requestStart = Date.now();
      const requestId = randomUUID().slice(0, 8);

      try {
        await this.handleRequest(req, res, requestId, requestStart);
      } catch (error) {
        const duration = Date.now() - requestStart;
        getLogger().error(`Request ${requestId} failed after ${duration}ms`, error as Error);
        this.sendError(res, error as Error);
      }
    };
  }

  private async handleRequest(
    req: IncomingMessage,
    res: ServerResponse,
    requestId: string,
    requestStart: number
  ): Promise<void> {
    // Check shutdown status
    if (this.isShuttingDown) {
      res.writeHead(503, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: { message: 'Server is shutting down', type: 'service_unavailable' } }));
      return;
    }

    // CORS headers
    this.setCorsHeaders(res);
    res.setHeader('X-Request-ID', requestId);

    // Handle OPTIONS
    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const url = this.buildUrl(req.url || '/');

    // Authentication
    if (this.config.apiKey && url.pathname !== '/health') {
      this.checkAuthentication(req);
    }

    // Rate limiting
    if (!this.checkRateLimit()) {
      throw new Error('Rate limit exceeded');
    }

    // Route to handlers
    if (req.method === 'GET' && url.pathname === '/health') {
      this.sendJson(res, 200, { status: 'ok', service: 'oauth2apilocal-standalone' });
      return;
    }

    if (req.method === 'GET' && url.pathname === '/v1/models') {
      const models = await this.router.listAllModels();
      this.sendJson(res, 200, { object: 'list', data: models });
      return;
    }

    if (req.method === 'POST' && url.pathname === '/v1/chat/completions') {
      await this.handleChatCompletion(req, res);
      return;
    }

    // 404 for unknown routes
    throw new Error(`Not found: ${url.pathname}`);
  }

  private async handleChatCompletion(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const body = await this.readJsonBody(req);
    const request = body as ChatCompletionRequest;

    if (!request.model || !request.messages) {
      throw new Error('Missing required fields: model, messages');
    }

    if (request.stream) {
      // Streaming response
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      });

      await this.router.streamChatCompletion(request, (chunk) => {
        res.write(chunk);
      });

      res.end();
    } else {
      // Non-streaming response
      const response = await this.router.chatCompletion(request);
      this.sendJson(res, 200, response);
    }
  }

  private checkAuthentication(req: IncomingMessage): void {
    const authHeader = req.headers['authorization'];
    const xApiKey = req.headers['x-api-key'];

    const providedKey = authHeader?.startsWith('Bearer ')
      ? authHeader.slice(7)
      : (typeof xApiKey === 'string' ? xApiKey : null);

    if (providedKey !== this.config.apiKey) {
      throw new Error('Invalid or missing API key');
    }
  }

  private checkRateLimit(): boolean {
    if (this.config.rateLimitPerMinute <= 0) {
      return true;
    }

    const now = Date.now();
    const oneMinuteAgo = now - 60000;

    // Remove old entries
    this.rateLimitBucket = this.rateLimitBucket.filter((time) => time > oneMinuteAgo);

    if (this.rateLimitBucket.length >= this.config.rateLimitPerMinute) {
      return false;
    }

    this.rateLimitBucket.push(now);
    return true;
  }

  private buildUrl(urlString: string): URL {
    return new URL(urlString, `http://localhost:${this.config.port}`);
  }

  private setCorsHeaders(res: ServerResponse): void {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key');
  }

  private sendJson(res: ServerResponse, status: number, data: any): void {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
  }

  private sendError(res: ServerResponse, error: Error): void {
    const status = 500;
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      error: {
        message: error.message,
        type: 'server_error',
      },
    }));
  }

  private async readJsonBody(req: IncomingMessage): Promise<any> {
    const maxSize = this.config.maxPayloadSizeMb * 1024 * 1024;
    const chunks: Buffer[] = [];
    let totalSize = 0;

    for await (const chunk of req) {
      totalSize += chunk.length;
      if (totalSize > maxSize) {
        throw new Error(`Payload too large (max ${this.config.maxPayloadSizeMb}MB)`);
      }
      chunks.push(chunk);
    }

    const body = Buffer.concat(chunks).toString('utf-8');
    return JSON.parse(body);
  }
}
