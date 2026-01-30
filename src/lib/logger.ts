/**
 * Intelligent logging utility for the frontend with syntax highlighting and semantic colorization
 *
 * Features:
 * - Log levels (ERROR, WARN, INFO, DEBUG, TRACE) with distinct colors
 * - Timestamp components with subtle styling
 * - Module paths with distinguishable hues
 * - Structured key-value pairs with consistent color mapping
 * - Multi-line message handling with proper indentation
 * - Works in both light and dark terminal themes
 */

type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error';

// Log level priority (higher number = more verbose)
const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
  trace: 4,
};

/**
 * Get the configured log level from environment variables
 * Defaults to 'debug' in development, 'info' in production
 */
function getConfiguredLogLevel(): LogLevel {
  const envLevel = import.meta.env.VITE_LOG_LEVEL;
  const validLevels: LogLevel[] = ['trace', 'debug', 'info', 'warn', 'error'];

  if (envLevel && validLevels.includes(envLevel)) {
    return envLevel;
  }

  // Default based on environment
  return import.meta.env.DEV ? 'debug' : 'info';
}

/**
 * Check if a log level should be logged based on the configured level
 */
function shouldLog(level: LogLevel, configuredLevel: LogLevel): boolean {
  return LOG_LEVEL_PRIORITY[level] <= LOG_LEVEL_PRIORITY[configuredLevel];
}

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: Date;
  context?: Record<string, unknown>;
}

// CSS-based styling for browser console
const cssStyles = {
  error:
    'background: #ff4444; color: white; padding: 2px 4px; border-radius: 2px; font-weight: bold;',
  warn: 'background: #ff8800; color: black; padding: 2px 4px; border-radius: 2px; font-weight: bold;',
  info: 'background: #00aaff; color: white; padding: 2px 4px; border-radius: 2px; font-weight: bold;',
  debug: 'background: #9966cc; color: white; padding: 2px 4px; border-radius: 2px;',
  trace: 'background: #666666; color: white; padding: 2px 4px; border-radius: 2px;',
  timestamp: 'color: #888888;',
  target: 'color: #66aaff; font-weight: 500;',
  separator: 'color: #555555;',
  key: 'color: #88cc66; font-weight: 500;',
  value: 'color: #ffcc88;',
};

/**
 * Get the short name for a log level
 */
function getLevelShortName(level: LogLevel): string {
  switch (level) {
    case 'error':
      return 'ERR';
    case 'warn':
      return 'WRN';
    case 'info':
      return 'INF';
    case 'debug':
      return 'DBG';
    case 'trace':
      return 'TRC';
  }
}

/**
 * Get the CSS style for a log level
 */
function getLevelStyle(level: LogLevel): string {
  switch (level) {
    case 'error':
      return cssStyles.error;
    case 'warn':
      return cssStyles.warn;
    case 'info':
      return cssStyles.info;
    case 'debug':
      return cssStyles.debug;
    case 'trace':
      return cssStyles.trace;
  }
}

/**
 * Format a timestamp with subtle styling
 */
function formatTimestamp(date: Date): { text: string; style: string } {
  const dateStr = date.toISOString().split('T')[0];
  const timeStr = date.toTimeString().split(' ')[0];
  return {
    text: `${dateStr} ${timeStr}`,
    style: cssStyles.timestamp,
  };
}

/**
 * Format structured key-value pairs with consistent color mapping
 */
function formatStructuredData(data: Record<string, unknown>): {
  text: string;
  styles: string[];
} {
  const parts: string[] = [];
  const styles: string[] = [];

  for (const [key, value] of Object.entries(data)) {
    // Add separator if not first item
    if (parts.length > 0) {
      parts.push('%c, ');
      styles.push(cssStyles.separator);
    }

    // Add key
    parts.push(`%c${key}`);
    styles.push(cssStyles.key);

    // Add separator
    parts.push('%c=');
    styles.push(cssStyles.separator);

    // Add value with appropriate styling
    const valueStr = formatValue(value);
    parts.push(`%c${valueStr}`);
    styles.push(cssStyles.value);
  }

  return { text: parts.join(''), styles };
}

/**
 * Format a single value based on its type
 */
function formatValue(value: unknown): string {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (typeof value === 'string') return `"${value}"`;
  if (typeof value === 'number') return value.toString();
  if (typeof value === 'boolean') return value.toString();
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return '[Object]';
    }
  }
  return String(value);
}

/**
 * Highlight key-value pairs in a message string
 */
function highlightKeyValues(message: string): {
  text: string;
  styles: string[];
} {
  const parts: string[] = [];
  const styles: string[] = [];
  let remaining = message;

  while (remaining.length > 0) {
    const eqIndex = remaining.indexOf('=');
    if (eqIndex === -1) {
      // No more key=value pairs
      parts.push(`%c${remaining}`);
      styles.push('');
      break;
    }

    // Find key start
    const beforeEq = remaining.slice(0, eqIndex);
    const keyStartIndex = Math.max(
      beforeEq.lastIndexOf(' '),
      beforeEq.lastIndexOf(','),
      beforeEq.lastIndexOf('{'),
      beforeEq.lastIndexOf('['),
      beforeEq.lastIndexOf('(')
    );
    const keyStart = keyStartIndex === -1 ? 0 : keyStartIndex + 1;

    // Add text before key
    if (keyStart > 0) {
      parts.push(`%c${beforeEq.slice(0, keyStart)}`);
      styles.push('');
    }

    // Add key
    const key = beforeEq.slice(keyStart);
    parts.push(`%c${key}`);
    styles.push(cssStyles.key);

    // Add equals sign
    parts.push('%c=');
    styles.push(cssStyles.separator);

    // Find value end
    remaining = remaining.slice(eqIndex + 1);
    const valueEndMatch = remaining.match(/[\s,}\])]/);
    const valueEnd = valueEndMatch?.index ?? remaining.length;

    // Add value
    const value = remaining.slice(0, valueEnd);
    parts.push(`%c${value}`);
    styles.push(cssStyles.value);

    // Continue with rest
    remaining = remaining.slice(valueEnd);
  }

  return { text: parts.join(''), styles };
}

class Logger {
  private isDevelopment = import.meta.env.DEV;
  private configuredLogLevel: LogLevel;

  constructor() {
    this.configuredLogLevel = getConfiguredLogLevel();
  }

  /**
   * Get the current configured log level
   */
  getLogLevel(): LogLevel {
    return this.configuredLogLevel;
  }

  /**
   * Set the log level at runtime
   */
  setLogLevel(level: LogLevel): void {
    this.configuredLogLevel = level;
  }

  /**
   * Log a trace message (most verbose)
   */
  trace(message: string, context?: Record<string, unknown>): void {
    this.log('trace', message, context);
  }

  /**
   * Log a debug message (development only)
   */
  debug(message: string, context?: Record<string, unknown>): void {
    this.log('debug', message, context);
  }

  /**
   * Log an info message
   */
  info(message: string, context?: Record<string, unknown>): void {
    this.log('info', message, context);
  }

  /**
   * Log a warning message
   */
  warn(message: string, context?: Record<string, unknown>): void {
    this.log('warn', message, context);
  }

  /**
   * Log an error message
   */
  error(message: string, context?: Record<string, unknown>): void {
    this.log('error', message, context);
  }

  private log(level: LogLevel, message: string, context?: Record<string, unknown>): void {
    // Check if this log level should be logged
    if (!shouldLog(level, this.configuredLogLevel)) {
      return;
    }

    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date(),
      context,
    };

    // Always log to console in development
    if (this.isDevelopment) {
      this.logToConsole(entry);
    }

    // In production, you could optionally send logs to Tauri backend
    // This is commented out to keep it simple, but here's how you might do it:
    /*
    if (!this.isDevelopment && (level === 'warn' || level === 'error')) {
      this.logToBackend(entry)
    }
    */
  }

  private logToConsole(entry: LogEntry): void {
    const timestamp = formatTimestamp(entry.timestamp);
    const levelShort = getLevelShortName(entry.level);
    const levelStyle = getLevelStyle(entry.level);

    // Build the log parts with styles
    const parts: string[] = [];
    const styles: string[] = [];

    // Timestamp
    parts.push(`%c${timestamp.text}`);
    styles.push(timestamp.style);

    // Separator
    parts.push('%c ');
    styles.push('');

    // Level badge
    parts.push(`%c[${levelShort}]`);
    styles.push(levelStyle);

    // Separator
    parts.push('%c ');
    styles.push('');

    // Message with key-value highlighting
    const highlighted = highlightKeyValues(entry.message);
    parts.push(highlighted.text);
    styles.push(...highlighted.styles);

    // Context if provided
    if (entry.context && Object.keys(entry.context).length > 0) {
      parts.push('%c ');
      styles.push('');

      const structured = formatStructuredData(entry.context);
      parts.push(structured.text);
      styles.push(...structured.styles);
    }

    // Determine console method based on level
    const consoleMethod = this.getConsoleMethod(entry.level);

    // Handle multi-line messages
    const fullMessage = parts.join('');
    if (fullMessage.includes('\n')) {
      const lines = fullMessage.split('\n');
      lines.forEach((line, index) => {
        if (index === 0) {
          consoleMethod(line, ...styles);
        } else {
          // Indent continuation lines
          consoleMethod(`%c    ${line}`, cssStyles.separator);
        }
      });
    } else {
      consoleMethod(fullMessage, ...styles);
    }
  }

  private getConsoleMethod(level: LogLevel): typeof console.log {
    switch (level) {
      case 'trace':
      case 'debug':
        return console.debug;
      case 'info':
        return console.info;
      case 'warn':
        return console.warn;
      case 'error':
        return console.error;
      default:
        return console.log;
    }
  }

  /*
  // Optional: Send logs to Tauri backend for system logging
  private async logToBackend(entry: LogEntry): Promise<void> {
    try {
      await invoke('log_from_frontend', {
        level: entry.level,
        message: entry.message,
        timestamp: entry.timestamp.toISOString(),
        context: entry.context,
      })
    } catch (error) {
      console.warn('Failed to send log to backend:', error)
    }
  }
  */
}

// Export a singleton logger instance
export const logger = new Logger();

// Export individual logging functions for convenience
export const { trace, debug, info, warn, error } = logger;
