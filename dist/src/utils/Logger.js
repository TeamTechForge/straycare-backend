"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Logger = void 0;
class Logger {
    /**
     * Logs an informational message.
     * Centralizing this allows for easy integration with external loggers (e.g., Datadog, AWS CloudWatch) later.
     */
    static info(message, meta) {
        const timestamp = new Date().toISOString();
        console.log(`[INFO] ${timestamp} - ${message}`, meta || "");
    }
    /**
     * Logs a warning message.
     */
    static warn(message, meta) {
        const timestamp = new Date().toISOString();
        console.warn(`[WARN] ${timestamp} - ${message}`, meta || "");
    }
    /**
     * Logs an error message.
     */
    static error(message, error) {
        const timestamp = new Date().toISOString();
        console.error(`[ERROR] ${timestamp} - ${message}`, error || "");
    }
}
exports.Logger = Logger;
//# sourceMappingURL=logger.js.map