import mongoose from "mongoose";
export interface FindNearestRescuerParams {
    latitude: number;
    longitude: number;
    excludeIds?: string[];
    caseId?: string;
}
export interface NearestRescuerResult {
    rescuer: mongoose.Document | any;
    distance: string;
}
export interface RescueRequestPayload {
    userId: string;
    caseId?: string;
    animalType?: string;
    description?: string;
    photos: string[];
    reporterName?: string;
    reporterPhone?: string;
    reporterAvatar?: string;
    reporterLocation?: any;
    rescueLocation?: any;
    distanceKm?: number;
    etaMinutes?: number;
    summary?: string;
}
export declare class RescueService {
    /**
     * Finds the nearest available rescuer based on coordinates, excluding specific IDs or the reporter themselves.
     */
    static findNearestRescuer(params: FindNearestRescuerParams): Promise<NearestRescuerResult | null>;
    /**
     * Encapsulates the complex logic of creating a rescue request, dispatching notifications, and simulating auto-resolution.
     *
     * @param payload - The strict typed payload containing reporter and rescue details.
     * @param rescuer - The nearest available rescuer document assigned to this request.
     * @returns A promise resolving to the created RescueRequest document.
     */
    static createRescueRequest(payload: RescueRequestPayload, rescuer: any): Promise<any>;
}
//# sourceMappingURL=RescueService.d.ts.map