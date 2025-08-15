import path from 'path';
import pino from 'pino';
import pretty from 'pino-pretty';
import { DATA_DIRECTORY, LOG_FILE } from './constants';

const createStream = (destination: NodeJS.WritableStream | string, colorize = false) =>
  pretty({
    destination,
    colorize,
    colorizeMessage: colorize,
    translateTime: 'SYS:yyyy-mm-dd HH:MM:ss',
    ignore: 'pid,hostname',
    sync: typeof destination === 'string',
  });

const level = process.env.LOG_LEVEL || 'info';
const consoleStream = createStream(process.stdout, true);
const fileStream = createStream(path.join(DATA_DIRECTORY, LOG_FILE));

export const getLogger = () => pino({ level }, pino.multistream([{ stream: consoleStream }, { stream: fileStream }]));
