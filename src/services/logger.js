import winston from "winston";
import "winston-daily-rotate-file";
import path from "path";

// Define log directory: backend root / storage / logs
const logDir = path.join(process.cwd(), "storage", "logs");

// Define format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  winston.format.printf(({ timestamp, level, message }) => {
    return `[${timestamp}] ${level.toUpperCase()}: ${message}`;
  })
);

// Create transports for different files requested manually
const laravelLog = new winston.transports.DailyRotateFile({
  filename: path.join(logDir, "laravel-%DATE%.log"),
  datePattern: "YYYY-MM-DD",
  maxSize: "20m",
  maxFiles: "14d",
  level: "info", // Logs everything info and above
});

// Since Node doesn't have "queue workers" native like Laravel,
// we will just create these file transports available for manual usage
// if you have specific worker scripts.

const queueWorkerLog = new winston.transports.DailyRotateFile({
  filename: path.join(logDir, "queue-worker-%DATE%.log"),
  datePattern: "YYYY-MM-DD",
  maxSize: "20m",
  maxFiles: "14d",
  level: "info",
});

const queueWorkerErrorLog = new winston.transports.DailyRotateFile({
  filename: path.join(logDir, "queue-worker-error-%DATE%.log"),
  datePattern: "YYYY-MM-DD",
  maxSize: "20m",
  maxFiles: "14d",
  level: "error",
});

const reverbLog = new winston.transports.DailyRotateFile({
  filename: path.join(logDir, "reverb-%DATE%.log"),
  datePattern: "YYYY-MM-DD",
  maxSize: "20m",
  maxFiles: "14d",
  level: "info",
});

const reverbErrorLog = new winston.transports.DailyRotateFile({
  filename: path.join(logDir, "reverb-error-%DATE%.log"),
  datePattern: "YYYY-MM-DD",
  maxSize: "20m",
  maxFiles: "14d",
  level: "error",
});

// Main Logger (for general app logs, mimicking laravel.log)
export const logger = winston.createLogger({
  format: logFormat,
  transports: [
    laravelLog,
    new winston.transports.Console({
      format: winston.format.simple(),
    }),
  ],
});

// Specific Loggers if you want to write to specific files separately
// Usage: queueLogger.info('Job processed');
export const queueLogger = winston.createLogger({
  format: logFormat,
  transports: [
    queueWorkerLog,
    queueWorkerErrorLog, // Errors will go to both if level is error
  ],
});

export const reverbLogger = winston.createLogger({
  format: logFormat,
  transports: [reverbLog, reverbErrorLog],
});

export default logger;
