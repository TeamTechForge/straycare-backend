import { Server } from "socket.io";
import { ICallStartDTO, ICallOfferDTO, ICallAnswerDTO, IIceCandidateDTO, ICallEndDTO, ICallDeclineDTO } from "../types/call";
declare class CallSignallingService {
    private activeConnections;
    registerUser(userId: string, socketId: string): void;
    unregisterUser(userId: string, socketId: string): void;
    handleCallStart(io: Server, payload: ICallStartDTO): void;
    handleCallOffer(io: Server, payload: ICallOfferDTO): void;
    handleCallAnswer(io: Server, payload: ICallAnswerDTO): void;
    handleIceCandidate(io: Server, payload: IIceCandidateDTO): void;
    handleCallDecline(io: Server, payload: ICallDeclineDTO): void;
    handleCallEnd(io: Server, payload: ICallEndDTO): void;
}
declare const _default: CallSignallingService;
export default _default;
//# sourceMappingURL=CallSignallingService.d.ts.map