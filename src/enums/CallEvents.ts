// src/enums/CallEvents.ts

export enum CallEvents {
  START = "call:start",
  INCOMING = "call:incoming",
  ACCEPTED = "call:accepted",
  DECLINED = "call:declined",
  ENDED = "call:ended",
  WEBRTC_OFFER = "webrtc:offer",
  WEBRTC_ANSWER = "webrtc:answer",
  WEBRTC_ICE_CANDIDATE = "webrtc:iceCandidate",
  BUSY = "call:busy",
  UNAUTHORIZED = "call:unauthorized",
}
