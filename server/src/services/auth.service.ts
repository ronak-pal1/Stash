import { ApiError } from "../libs/apiError.js";
import { signAccessToken } from "../libs/jwt.js";
import { User, type UserDocument } from "../models/user.model.js";

export const toPublicUser = (user: UserDocument) => ({
  id: user._id.toString(),
  name: user.name,
  email: user.email,
  createdAt: user.createdAt,
});

const issueSession = (user: UserDocument) => ({
  user: toPublicUser(user),
  token: signAccessToken(user._id.toString()),
});

export const registerUser = async (input: { name: string; email: string; password: string }) => {
  const existing = await User.findOne({ email: input.email }).select("_id");
  if (existing) {
    throw new ApiError(409, "Email is already registered");
  }

  const user = await User.create(input);
  return issueSession(user);
};

export const loginUser = async (input: { email: string; password: string }) => {
  const user = await User.findOne({ email: input.email }).select("+password");

  if (!user || !(await user.comparePassword(input.password))) {
    throw new ApiError(401, "Invalid email or password");
  }

  return issueSession(user);
};

export const getCurrentUser = async (userId: string) => {
  const user = await User.findById(userId);
  if (!user) {
    throw new ApiError(401, "Authentication required");
  }

  return toPublicUser(user);
};
