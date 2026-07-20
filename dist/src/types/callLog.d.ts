import { CallStatus } from "../enums/CallStatus.enum";
import { CallDirection } from "../enums/CallDirection.enum";
import { ICallParticipantDTO } from "./call";
export interface ICallLogDTO {
    _id: string;
    caller: ICallParticipantDTO;
    receiver: ICallParticipantDTO;
    status: CallStatus;
    direction: CallDirection;
    startedAt?: string;
    answeredAt?: string;
    endedAt?: string;
    duration: number;
    createdAt: string;
}
//# sourceMappingURL=callLog.d.ts.map