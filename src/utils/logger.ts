export class Logger {
  /**
   * Logs an informational message.
   * Centralizing this allows for easy integration with external loggers (e.g., Datadog, AWS CloudWatch) later.
   */
  public static info(message: string, meta?: any): void {
    const timestamp = new Date().toISOString();
    console.log(`[INFO] ${timestamp} - ${message}`, meta || "");
  }

  /**
   * Logs a warning message.
   */
  public static warn(message: string, meta?: any): void {
    const timestamp = new Date().toISOString();
    console.warn(`[WARN] ${timestamp} - ${message}`, meta || "");
  }

  /**
   * Logs an error message.
   */
  public static error(message: string, error?: any): void {
    const timestamp = new Date().toISOString();
    console.error(`[ERROR] ${timestamp} - ${message}`, error || "");
  }
}
