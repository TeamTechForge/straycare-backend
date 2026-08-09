declare class PrivacyService {
    /**
     * Checks if two users share an active operational case (Rescue, Adoption, etc.)
     * or a non-direct conversation (which covers community interactions).
     */
    isRelated(userA: string, userB: string): Promise<boolean>;
    canMessage(senderId: string, recipientId: string): Promise<{
        allowed: boolean;
        reason?: string;
    }>;
    canCall(callerId: string, receiverId: string): Promise<{
        allowed: boolean;
        reason?: string;
    }>;
}
declare const _default: PrivacyService;
export default _default;
//# sourceMappingURL=privacyService.d.ts.map