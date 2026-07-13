export declare class NotificationService {
    /**
     * Safely creates and dispatches an in-app notification to a user.
     * Internally catches and logs any database failures to prevent
     * non-critical notification errors from crashing primary business workflows.
     *
     * @param userId - The MongoDB ObjectId of the recipient user.
     * @param title - A short, descriptive title for the notification.
     * @param message - The detailed body text of the notification.
     * @param type - The severity/category of the notification. Defaults to "info".
     * @returns A promise that resolves when the operation is complete (or caught).
     */
    static sendNotification(userId: string, title: string, message: string, type?: "info" | "success" | "warning" | "error" | "welcome"): Promise<void>;
}
//# sourceMappingURL=NotificationService.d.ts.map