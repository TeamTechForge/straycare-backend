import { Server } from "socket.io";
import { ICallStartDTO, ICallOfferDTO, ICallAnswerDTO, IIceCandidateDTO, ICallEndDTO, ICallDeclineDTO, ICallAcceptDTO } from "../types/call";
declare class CallSignallingService {
    private activeConnections;
    private ringTimeouts;
    private getRingKey;
    private clearRingTimeout;
    registerUser(userId: string, socketId: string): void;
    unregisterUser(userId: string, socketId: string): void;
    handleCallStart(io: Server, payload: ICallStartDTO): Promise<void>;
    handleCallAccept(io: Server, payload: ICallAcceptDTO): void;
    private verifyActiveSession;
    handleCallOffer(io: Server, payload: ICallOfferDTO): Promise<void>;
    handleCallAnswer(io: Server, payload: ICallAnswerDTO): Promise<void>;
    handleIceCandidate(io: Server, payload: IIceCandidateDTO): Promise<void>;
    handleCallDecline(io: Server, payload: ICallDeclineDTO): void;
    handleCallEnd(io: Server, payload: ICallEndDTO, endedByUserId?: string): void;
    handleDisconnect(io: Server, userId: string): Promise<void>;
}
declare const _default: CallSignallingService;
export default _default;
//# sourceMappingURL=callSignallingService.d.ts.map