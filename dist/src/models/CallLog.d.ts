import mongoose from "mongoose";
import { CallStatus } from "../enums/CallStatus.enum";
export interface ICallLog extends mongoose.Document {
    caller: mongoose.Types.ObjectId;
    receiver: mongoose.Types.ObjectId;
    status: CallStatus;
    startedAt?: Date;
    answeredAt?: Date;
    endedAt?: Date;
    duration: number;
    isSeen: boolean;
    createdAt: Date;
    updatedAt: Date;
}
declare const _default: mongoose.Model<ICallLog, {}, {}, {}, mongoose.Document<unknown, {}, ICallLog, {}, mongoose.DefaultSchemaOptions> & ICallLog & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
} & {
    id: string;
}, any, ICallLog>;
export default _default;
//# sourceMappingURL=CallLog.d.ts.map