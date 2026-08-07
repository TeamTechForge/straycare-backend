export interface ICallParticipantDTO {
    userId: string;
    name: string;
    profileImage?: string;
}
export interface ICallStartDTO {
    caller: ICallParticipantDTO;
    calleeId: string;
}
export interface ICallOfferDTO {
    callerId: string;
    calleeId: string;
    offer: any;
}
export interface ICallAnswerDTO {
    callerId: string;
    calleeId: string;
    answer: any;
}
export interface IIceCandidateDTO {
    callerId: string;
    calleeId: string;
    candidate: any;
}
export interface ICallEndDTO {
    callerId: string;
    calleeId: string;
}
export interface ICallDeclineDTO {
    callerId: string;
    calleeId: string;
}
export interface ICallAcceptDTO {
    callerId: string;
    calleeId: string;
}
//# sourceMappingURL=call.d.ts.map