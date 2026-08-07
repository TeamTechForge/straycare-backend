export declare class Logger {
    /**
     * Logs an informational message.
     * Centralizing this allows for easy integration with external loggers (e.g., Datadog, AWS CloudWatch) later.
     */
    static info(message: string, meta?: any): void;
    /**
     * Logs a warning message.
     */
    static warn(message: string, meta?: any): void;
    /**
     * Logs an error message.
     */
    static error(message: string, error?: any): void;
}
//# sourceMappingURL=logger.d.ts.map