import { getFileSink } from '@logtape/file';
import {
  configureSync,
  FormattedValues,
  getAnsiColorFormatter,
  getConsoleSink,
  getLogger as getLogTapeLogger,
  getTextFormatter,
  Logger,
  Sink,
  TextFormatterOptions,
} from '@logtape/logtape';
import fs from 'node:fs';
import path from 'node:path';
import { DATA_DIRECTORY, LOG_FILE } from './constants';

const level = process.env.LOG_LEVEL ?? 'info';
const logFilePath = path.join(DATA_DIRECTORY, LOG_FILE);

const isFileWritable = (filePath: string): boolean => {
  try {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.closeSync(fs.openSync(filePath, 'a'));
    return true;
  } catch {
    return false;
  }
};

const format = (values: FormattedValues) =>
  `[${formatDate(new Date(values.record.timestamp))}] ${values.level}: ${values.message}`;

function formatDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

export const getLogger = (): Logger => {
  const options: TextFormatterOptions = { level: 'FULL', format };
  const sinks: Record<string, Sink> = { console: getConsoleSink({ formatter: getAnsiColorFormatter(options) }) };
  const category = 'degiromatic';

  if (isFileWritable(logFilePath)) {
    sinks.file = getFileSink(logFilePath, { formatter: getTextFormatter(options) });
  }

  configureSync({
    sinks,
    loggers: [
      { category: ['logtape', 'meta'], lowestLevel: 'warning', sinks: ['console'] },
      { category, lowestLevel: level as never, sinks: Object.keys(sinks) },
    ],
  });
  return getLogTapeLogger(category);
};

export const logError = (logger: ReturnType<typeof getLogTapeLogger>, error: unknown) =>
  logger.error(error instanceof Error ? error.message : `Unknown Error: "${error}"`);
