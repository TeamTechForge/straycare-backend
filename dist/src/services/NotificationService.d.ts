export declare class NotificationService {
    /**
     * Safely creates and dispatches an in-app notification and push notification to a user.
     *
     * @param userId - The MongoDB ObjectId of the recipient user.
     * @param title - A short, descriptive title for the notification.
     * @param message - The detailed body text of the notification.
     * @param type - The severity/category of the notification. Defaults to "info".
     * @param rescueRequestId - Optional rescue request ID.
     * @param caseId - Optional case ID.
     */
    static sendNotification(userId: string, title: string, message: string, type?: "info" | "success" | "warning" | "error" | "welcome", rescueRequestId?: string, caseId?: string): Promise<void>;
}
//# sourceMappingURL=notificationService.d.ts.map