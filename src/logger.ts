import { createLogger, format, transports } from "winston";
import { LOG_FILE } from "./constants";
import { getConfigDirectory } from "./util";

export function getLogger() {
  const logFormat = format.combine(
    format((info) => {
      info.level = info.level.toUpperCase();
      return info;
    })(),
    format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    format.printf(
      ({ timestamp, level, message }) => `${timestamp} [${level}] ${message}`
    )
  );

  const transportList = [
    new transports.Console({
      format: format.combine(logFormat, format.colorize({ all: true })),
    }),
    new transports.File({
      filename: getConfigDirectory() + LOG_FILE,
      format: logFormat,
    }),
  ];

  return createLogger({ transports: transportList });
}
