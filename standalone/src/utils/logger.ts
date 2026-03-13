/**
 * Masked logging utility - ensures no raw tokens or secrets are logged
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

export interface LoggerConfig {
  level: LogLevel;
  enableColors: boolean;
}

// ASSUMPTION: Standard ANSI color codes work across platforms
const COLORS = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  green: '\x1b[32m',
  blue: '\x1b[34m',
  gray: '\x1b[90m',
};

// Patterns to redact
const SECRET_PATTERNS = [
  { pattern: /Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi, replacement: 'Bearer ***' },
  { pattern: /(api[_-]?key[=:])\s*[^\s&]+/gi, replacement: '$1***' },
  { pattern: /(sk-[a-zA-Z0-9]{20,})/gi, replacement: '***' },
  { pattern: /(token[=:])\s*[^\s&]+/gi, replacement: '$1***' },
  { pattern: /(password[=:])\s*[^\s&]+/gi, replacement: '$1***' },
  { pattern: /(secret[=:])\s*[^\s&]+/gi, replacement: '$1***' },
  { pattern: /"password"\s*:\s*"[^"]*"/gi, replacement: '"password":"***"' },
];

export class Logger {
  private config: LoggerConfig;

  constructor(config: Partial<LoggerConfig> = {}) {
    this.config = {
      level: config.level ?? LogLevel.INFO,
      enableColors: config.enableColors ?? true,
    };
  }

  setLevel(level: LogLevel): void {
    this.config.level = level;
  }

  /**
   * Mask sensitive data in log messages
   */
  private mask(message: string): string {
    let masked = message;
    for (const { pattern, replacement } of SECRET_PATTERNS) {
      masked = masked.replace(pattern, replacement);
    }
    return masked;
  }

  private format(level: string, color: string, message: string): string {
    const timestamp = new Date().toISOString();
    const maskedMessage = this.mask(message);

    if (this.config.enableColors) {
      return `${COLORS.gray}${timestamp}${COLORS.reset} ${color}[${level}]${COLORS.reset} ${maskedMessage}`;
    }
    return `${timestamp} [${level}] ${maskedMessage}`;
  }

  debug(message: string): void {
    if (this.config.level <= LogLevel.DEBUG) {
      console.debug(this.format('DEBUG', COLORS.blue, message));
    }
  }

  info(message: string): void {
    if (this.config.level <= LogLevel.INFO) {
      console.info(this.format('INFO', COLORS.green, message));
    }
  }

  warn(message: string): void {
    if (this.config.level <= LogLevel.WARN) {
      console.warn(this.format('WARN', COLORS.yellow, message));
    }
  }

  error(message: string, error?: Error): void {
    if (this.config.level <= LogLevel.ERROR) {
      const errorMsg = error ? `${message}: ${error.message}` : message;
      console.error(this.format('ERROR', COLORS.red, errorMsg));
      if (error?.stack) {
        console.error(COLORS.gray + error.stack + COLORS.reset);
      }
    }
  }
}

// Global logger instance
let globalLogger: Logger | undefined;

export function getLogger(): Logger {
  if (!globalLogger) {
    globalLogger = new Logger();
  }
  return globalLogger;
}

export function setLogger(logger: Logger): void {
  globalLogger = logger;
}
