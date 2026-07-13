interface ProfileResult {
    profileData: any;
    stats: any;
}
export declare class ProfileStatsService {
    private static readonly strategies;
    /**
     * Aggregates profile data and statistics dynamically using a Strategy Pattern based on the user's role.
     * Eliminates the need for bloated switch statements and ensures Open/Closed Principle adherence.
     *
     * @param userId - The MongoDB ObjectId of the user.
     * @param role - The string representation of the user's role (e.g., 'general_user', 'vet').
     * @returns A promise resolving to the user's profile data and their aggregated app statistics.
     */
    static getProfileAndStats(userId: string, role: string): Promise<ProfileResult>;
}
export {};
//# sourceMappingURL=ProfileStatsService.d.ts.map