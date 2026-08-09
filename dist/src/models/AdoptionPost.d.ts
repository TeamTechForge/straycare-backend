import mongoose, { Document } from "mongoose";
export interface IPost extends Document {
    userId: mongoose.Types.ObjectId;
    category: string;
    customCategory?: string;
    breed: string;
    age: string;
    gender: string;
    name: string;
    status: "Available" | "Pending" | "Adopted";
    healthStatus: "Healthy" | "Needs Care" | "Under Treatment" | "Special Needs";
    description: string;
    traits: string[];
    images: string[];
    location: string;
    posterName: string;
    contact: string;
    notes?: string;
    createdAt: Date;
    updatedAt: Date;
}
declare const _default: mongoose.Model<IPost, {}, {}, {}, mongoose.Document<unknown, {}, IPost, {}, mongoose.DefaultSchemaOptions> & IPost & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
} & {
    id: string;
}, any, IPost>;
export default _default;
//# sourceMappingURL=AdoptionPost.d.ts.map