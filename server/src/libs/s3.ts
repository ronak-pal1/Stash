import { S3Client } from "@aws-sdk/client-s3";
import { env, isS3Configured } from "../config/env.js";
import { ApiError } from "./apiError.js";

let client: S3Client | undefined;

export const requireS3Config = () => {
  if (!isS3Configured() || !env.AWS_REGION || !env.AWS_ACCESS_KEY_ID || !env.AWS_SECRET_ACCESS_KEY || !env.AWS_S3_BUCKET) {
    const missing = [
      ["AWS_REGION", env.AWS_REGION],
      ["AWS_ACCESS_KEY_ID", env.AWS_ACCESS_KEY_ID],
      ["AWS_SECRET_ACCESS_KEY", env.AWS_SECRET_ACCESS_KEY],
      ["AWS_S3_BUCKET", env.AWS_S3_BUCKET],
    ]
      .filter(([, value]) => !value)
      .map(([key]) => key);

    throw new ApiError(503, `File storage is not configured. Missing: ${missing.join(", ")}`);
  }

  return {
    region: env.AWS_REGION,
    accessKeyId: env.AWS_ACCESS_KEY_ID,
    secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
    bucket: env.AWS_S3_BUCKET,
  };
};

export const getS3Client = () => {
  const config = requireS3Config();

  if (!client) {
    client = new S3Client({
      region: config.region,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
  }

  return { client, bucket: config.bucket };
};
