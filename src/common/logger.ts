/**
 * Module providing logging functionality
 *
 * This module configures and provides loggers used throughout the library.
 * By default, it does not output anything, allowing application-side log control.
 */

/**
 * Log level
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * Log level priority (higher number = more important)
 */
const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

/**
 * Logger handler
 */
export type LogHandler = (
  level: LogLevel,
  name: string,
  message: string,
  ...args: unknown[]
) => void;

/**
 * NullHandler: Outputs nothing (default)
 */
export const nullHandler: LogHandler = () => {
  // Do nothing
};

/**
 * ConsoleHandler: Outputs to console
 */
export const consoleHandler: LogHandler = (
  level: LogLevel,
  name: string,
  message: string,
  ...args: unknown[]
) => {
  const timestamp = new Date().toISOString();
  const formattedMessage = `${timestamp} [${name}/${level.toUpperCase()}] ${message}`;

  switch (level) {
    case 'debug':
      console.debug(formattedMessage, ...args);
      break;
    case 'info':
      console.info(formattedMessage, ...args);
      break;
    case 'warn':
      console.warn(formattedMessage, ...args);
      break;
    case 'error':
      console.error(formattedMessage, ...args);
      break;
  }
};

/**
 * Logger class
 */
export class Logger {
  private readonly name: string;
  private handler: LogHandler;
  private level: LogLevel;

  constructor(name: string, handler: LogHandler = nullHandler, level: LogLevel = 'warn') {
    this.name = name;
    this.handler = handler;
    this.level = level;
  }

  /**
   * Set handler
   */
  setHandler(handler: LogHandler): void {
    this.handler = handler;
  }

  /**
   * Set log level
   */
  setLevel(level: LogLevel): void {
    this.level = level;
  }

  /**
   * Check if the specified level should be logged
   */
  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[this.level];
  }

  /**
   * Output log
   */
  private log(level: LogLevel, message: string, ...args: unknown[]): void {
    if (this.shouldLog(level)) {
      this.handler(level, this.name, message, ...args);
    }
  }

  debug(message: string, ...args: unknown[]): void {
    this.log('debug', message, ...args);
  }

  info(message: string, ...args: unknown[]): void {
    this.log('info', message, ...args);
  }

  warn(message: string, ...args: unknown[]): void {
    this.log('warn', message, ...args);
  }

  error(message: string, ...args: unknown[]): void {
    this.log('error', message, ...args);
  }
}

/**
 * Get logger
 * @param name - Logger name (default: "wikidot")
 * @returns Logger instance
 */
export function getLogger(name = 'wikidot'): Logger {
  return new Logger(name);
}

/**
 * Setup console output handler
 * @param logger - Logger to configure
 * @param level - Log level (default: "warn")
 */
export function setupConsoleHandler(logger: Logger, level: LogLevel = 'warn'): void {
  logger.setHandler(consoleHandler);
  logger.setLevel(level);
}

/**
 * Default logger used throughout the package
 */
export const logger: Logger = getLogger();
