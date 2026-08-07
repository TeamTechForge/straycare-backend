import type { Request, Response, NextFunction } from "express";
export interface IDonationInitiateRequest {
    amount: string;
    organizationId?: string;
    items?: string;
    category?: string;
    organization?: string;
    frequency?: string;
    plan?: string;
}
export interface IDonationSaveRequest {
    orderId: string;
    amount: string | number;
    category?: string;
    organization?: string;
    organizationId?: string;
    frequency?: string;
    plan?: string;
    status?: string;
}
export declare class DonationController {
    private static readonly baseUrl;
    initiateDonation: (req: Request, res: Response, next: NextFunction) => void;
    getPayCheckout: (req: Request, res: Response) => void;
    saveDonation: (req: Request, res: Response, next: NextFunction) => void;
    notifyPayhere: (req: Request, res: Response) => void;
    getHistory: (req: Request, res: Response, next: NextFunction) => void;
    getTotalForOrg: (req: Request, res: Response, next: NextFunction) => void;
    getReceivedDonations: (req: Request, res: Response, next: NextFunction) => void;
    getAllDonations: (req: Request, res: Response, next: NextFunction) => void;
}
export declare const donationController: DonationController;
//# sourceMappingURL=donationController.d.ts.map