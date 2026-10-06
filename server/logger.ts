import { appendFileSync } from 'node:fs';
import { resolve } from 'node:path';

const logPath = resolve(process.cwd(), 'app-debug.txt');

export function logInfo(message: string): void {
  writeLog('INFO', message);
}

export function logWarn(message: string): void {
  writeLog('WARN', message);
}

export function logError(message: string, error?: unknown): void {
  const detail = error instanceof Error ? error.stack ?? error.message : error === undefined ? '' : String(error);
  writeLog('ERROR', detail ? `${message}\n${detail}` : message);
}

function writeLog(level: 'INFO' | 'WARN' | 'ERROR', message: string): void {
  const entry = `${new Date().toISOString()} [${level}] ${message}\n`;
  if (level === 'ERROR') {
    console.error(entry.trimEnd());
  } else {
    console.log(entry.trimEnd());
  }

  try {
    appendFileSync(logPath, entry, 'utf8');
  } catch (error) {
    console.error(`Unable to write debug log to ${logPath}:`, error);
  }
}
