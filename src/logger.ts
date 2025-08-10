import dotenv from "dotenv";
import { createLogger, format, transports } from "winston";
import { CONFIG_DIRECTORY, LOG_FILE } from "./constants";

export function getLogger() {
  const logFormat = format.combine(
    format((info) => {
      info.level = info.level.toUpperCase();
      return info;
    })(),
    format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    format.printf(({ timestamp, level, message }) => `${timestamp} [${level}] ${message}`)
  );

  const transportList = [
    new transports.Console({ format: format.combine(logFormat, format.colorize({ all: true })) }),
    new transports.File({ filename: CONFIG_DIRECTORY + LOG_FILE, format: logFormat }),
  ];

  dotenv.config({ quiet: true });
  return createLogger({ level: process.env.LOG_LEVEL, transports: transportList });
}
