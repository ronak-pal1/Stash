import bcrypt from "bcryptjs";
import mongoose, { Schema, type HydratedDocument, type Model } from "mongoose";
import { env } from "../config/env.js";

export type PlanName = "free" | "pro" | "team";

export interface IUser {
  name: string;
  email: string;
  password: string;
  avatarPath?: string | null;
  plan: PlanName;
  trialEndsAt?: Date | null;
  resetTokenHash?: string | null;
  resetTokenExpires?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface IUserMethods {
  comparePassword(candidate: string): Promise<boolean>;
}

export type UserDocument = HydratedDocument<IUser, IUserMethods>;
type UserModel = Model<IUser, {}, IUserMethods>;

const userSchema = new Schema<IUser, UserModel, IUserMethods>(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, minlength: 8, select: false },
    avatarPath: { type: String, default: null },
    plan: { type: String, enum: ["free", "pro", "team"], default: "free" },
    trialEndsAt: { type: Date, default: null },
    resetTokenHash: { type: String, default: null, select: false },
    resetTokenExpires: { type: Date, default: null, select: false },
  },
  { timestamps: true },
);

userSchema.pre("save", async function () {
  if (!this.isModified("password")) return;
  this.password = await bcrypt.hash(this.password, env.BCRYPT_ROUNDS);
});

userSchema.methods.comparePassword = function (candidate: string) {
  return bcrypt.compare(candidate, this.password);
};

export const User = mongoose.model<IUser, UserModel>("User", userSchema);

export const publicUser = (user: Pick<IUser, "name" | "email" | "plan" | "trialEndsAt" | "avatarPath" | "createdAt"> & { _id: { toString(): string } }) => ({
  id: user._id.toString(),
  name: user.name,
  email: user.email,
  plan: user.plan,
  trialEndsAt: user.trialEndsAt ?? null,
  avatarUrl: user.avatarPath ? `/api/v1/files/avatar/${user._id.toString()}` : null,
  createdAt: user.createdAt,
});
