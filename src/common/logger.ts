/**
 * ロギング機能を提供するモジュール
 *
 * このモジュールは、ライブラリ全体で使用されるロガーを設定し、提供する。
 * デフォルトでは出力を行わず、アプリケーション側でのログ制御を可能にする。
 */

/**
 * ログレベル
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * ログレベルの優先度（数値が大きいほど重要）
 */
const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

/**
 * ロガーハンドラー
 */
export type LogHandler = (
  level: LogLevel,
  name: string,
  message: string,
  ...args: unknown[]
) => void;

/**
 * NullHandler: 何も出力しない（デフォルト）
 */
export const nullHandler: LogHandler = () => {
  // 何もしない
};

/**
 * ConsoleHandler: コンソールに出力する
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
 * ロガークラス
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
   * ハンドラーを設定
   */
  setHandler(handler: LogHandler): void {
    this.handler = handler;
  }

  /**
   * ログレベルを設定
   */
  setLevel(level: LogLevel): void {
    this.level = level;
  }

  /**
   * 指定レベルがログ出力対象かどうか
   */
  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[this.level];
  }

  /**
   * ログ出力
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
 * ロガーを取得
 * @param name - ロガー名（デフォルト: "wikidot"）
 * @returns ロガーインスタンス
 */
export function getLogger(name = 'wikidot'): Logger {
  return new Logger(name);
}

/**
 * コンソール出力用ハンドラを設定
 * @param logger - 設定するロガー
 * @param level - ログレベル（デフォルト: "warn"）
 */
export function setupConsoleHandler(logger: Logger, level: LogLevel = 'warn'): void {
  logger.setHandler(consoleHandler);
  logger.setLevel(level);
}

/**
 * パッケージ全体で使用されるデフォルトロガー
 */
export const logger: Logger = getLogger();
