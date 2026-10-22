import request from "supertest";
import { app } from "../app.js";

export const agent = () => request.agent(app);

export const register = async (email = `ada-${Date.now()}@example.com`, name = "Ada Lovelace") => {
  const response = await request(app).post("/api/v1/auth/register").send({
    name,
    email,
    password: "password123",
  });
  if (response.status !== 201) {
    throw new Error(`register failed ${response.status} ${JSON.stringify(response.body)}`);
  }
  return {
    email,
    token: response.body.data.accessToken as string,
    userId: response.body.data.user.id as string,
    workspaceId: "",
  };
};

export const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
