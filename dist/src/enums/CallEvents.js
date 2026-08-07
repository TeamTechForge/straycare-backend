"use strict";
// src/enums/CallEvents.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.CallEvents = void 0;
var CallEvents;
(function (CallEvents) {
    CallEvents["START"] = "call:start";
    CallEvents["INCOMING"] = "call:incoming";
    CallEvents["ACCEPTED"] = "call:accepted";
    CallEvents["DECLINED"] = "call:declined";
    CallEvents["ENDED"] = "call:ended";
    CallEvents["WEBRTC_OFFER"] = "webrtc:offer";
    CallEvents["WEBRTC_ANSWER"] = "webrtc:answer";
    CallEvents["WEBRTC_ICE_CANDIDATE"] = "webrtc:iceCandidate";
    CallEvents["BUSY"] = "call:busy";
    CallEvents["UNAUTHORIZED"] = "call:unauthorized";
})(CallEvents || (exports.CallEvents = CallEvents = {}));
//# sourceMappingURL=CallEvents.js.map