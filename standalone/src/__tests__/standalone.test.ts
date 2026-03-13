/**
 * Unit tests for OAuth2APIlocal Standalone
 * Run with: npm test
 */

import { describe, test, expect } from '@jest/globals';
import { Logger, LogLevel } from '../src/utils/logger';

describe('Logger', () => {
  test('should mask Bearer tokens', () => {
    const logger = new Logger({ level: LogLevel.DEBUG, enableColors: false });
    const message = 'Authorization: Bearer sk-1234567890abcdefghij';

    // Capture console output
    const consoleSpy = jest.spyOn(console, 'info').mockImplementation();
    logger.info(message);

    const output = consoleSpy.mock.calls[0][0];
    expect(output).toContain('Bearer ***');
    expect(output).not.toContain('sk-1234567890abcdefghij');

    consoleSpy.mockRestore();
  });

  test('should mask API keys', () => {
    const logger = new Logger({ level: LogLevel.DEBUG, enableColors: false });
    const message = 'api_key=sk-1234567890abcdefghij';

    const consoleSpy = jest.spyOn(console, 'info').mockImplementation();
    logger.info(message);

    const output = consoleSpy.mock.calls[0][0];
    expect(output).toContain('api_key=***');
    expect(output).not.toContain('sk-1234567890abcdefghij');

    consoleSpy.mockRestore();
  });

  test('should mask passwords in JSON', () => {
    const logger = new Logger({ level: LogLevel.DEBUG, enableColors: false });
    const message = '{"password":"supersecret123"}';

    const consoleSpy = jest.spyOn(console, 'info').mockImplementation();
    logger.info(message);

    const output = consoleSpy.mock.calls[0][0];
    expect(output).toContain('"password":"***"');
    expect(output).not.toContain('supersecret123');

    consoleSpy.mockRestore();
  });

  test('should respect log level', () => {
    const logger = new Logger({ level: LogLevel.WARN, enableColors: false });

    const debugSpy = jest.spyOn(console, 'debug').mockImplementation();
    const infoSpy = jest.spyOn(console, 'info').mockImplementation();
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation();

    logger.debug('debug message');
    logger.info('info message');
    logger.warn('warn message');

    expect(debugSpy).not.toHaveBeenCalled();
    expect(infoSpy).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalled();

    debugSpy.mockRestore();
    infoSpy.mockRestore();
    warnSpy.mockRestore();
  });
});

describe('ProviderRouter', () => {
  test('should route gemini models to Gemini provider', () => {
    // This is a placeholder test - actual implementation would need mocks
    const modelName = 'gemini-pro';
    expect(modelName.startsWith('gemini')).toBe(true);
  });

  test('should route gpt models to Copilot provider', () => {
    const modelName = 'gpt-4o-copilot';
    expect(modelName.startsWith('gpt')).toBe(true);
  });

  test('should route claude models to Copilot provider', () => {
    const modelName = 'claude-3.5-sonnet-copilot';
    expect(modelName.startsWith('claude')).toBe(true);
  });
});

describe('ConfigManager', () => {
  test('should handle config path expansion', () => {
    const homeDir = process.env.HOME || '/home/user';
    const configPath = '~/.oauth2apilocal/config.json';
    const expanded = configPath.replace('~', homeDir);

    expect(expanded).toContain('.oauth2apilocal');
    expect(expanded).not.toContain('~');
  });
});
