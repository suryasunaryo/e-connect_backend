import { logger, queueLogger, reverbLogger } from "./src/services/logger.js";

// Test Main Logger (laravel.log)
logger.info("This is a test log entry for laravel.log");
logger.error("This is a test error for laravel.log");

// Test Queue Logger
queueLogger.info("Queue job processed successfully");
queueLogger.error("Queue job failed");

// Test Reverb Logger
reverbLogger.info("Reverb connection established");
reverbLogger.error("Reverb socket error");

console.log("Logs written to storage/logs. Please check the directory.");
