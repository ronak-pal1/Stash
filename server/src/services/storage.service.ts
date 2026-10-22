import path from "node:path";
import { randomUUID } from "node:crypto";
import { DeleteObjectsCommand, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getS3Client } from "../libs/s3.js";

export const DOWNLOAD_URL_TTL_SECONDS = 60 * 15;

export const sanitizeFileName = (originalName: string) => {
  const base = path.basename(originalName).replace(/[^\w.\- ()]/g, "_").trim();
  return (base || "file").slice(0, 180);
};

export const buildAttachmentKey = (userId: string, noteId: string, originalName: string) => {
  const extension = path.extname(originalName).toLowerCase();
  const safeExtension = /^\.[a-z0-9]{1,8}$/.test(extension) ? extension : "";
  return `users/${userId}/notes/${noteId}/${randomUUID()}${safeExtension}`;
};

export const uploadObject = async (input: { key: string; body: Buffer; contentType: string }) => {
  const { client, bucket } = getS3Client();

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: input.key,
      Body: input.body,
      ContentType: input.contentType,
    }),
  );
};

export const deleteStoredObjects = async (keys: string[]) => {
  if (keys.length === 0) return;

  const { client, bucket } = getS3Client();

  for (let index = 0; index < keys.length; index += 1000) {
    const chunk = keys.slice(index, index + 1000);
    await client.send(
      new DeleteObjectsCommand({
        Bucket: bucket,
        Delete: {
          Objects: chunk.map((key) => ({ Key: key })),
          Quiet: true,
        },
      }),
    );
  }
};

export const getDownloadUrl = async (key: string) => {
  const { client, bucket } = getS3Client();

  return getSignedUrl(client, new GetObjectCommand({ Bucket: bucket, Key: key }), {
    expiresIn: DOWNLOAD_URL_TTL_SECONDS,
  });
};
