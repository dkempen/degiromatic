import dotenv from 'dotenv';

dotenv.config({ quiet: true });

export const DATA_DIRECTORY = process.env.DATA_DIR || 'data';
export const SESSION_FILE = 'session';
export const LOG_FILE = 'degiromatic.log';
