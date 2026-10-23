import { createReadStream } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { PutObjectCommand, S3Client, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import sharp from "sharp";
import { env, isS3Configured } from "../config/env.js";
import { ApiError } from "../libs/apiError.js";

export interface StoredObject {
  storagePath: string;
  mimeType: string;
  size: number;
}

const localRoot = () => path.resolve(process.cwd(), env.UPLOAD_DIR);

const s3 = () =>
  new S3Client({
    region: env.AWS_REGION,
    credentials: {
      accessKeyId: env.AWS_ACCESS_KEY_ID ?? "",
      secretAccessKey: env.AWS_SECRET_ACCESS_KEY ?? "",
    },
  });

export const saveBuffer = async (input: Buffer, filename: string, mimeType: string, kind: "image" | "audio" | "file" | "avatar"): Promise<StoredObject> => {
  let body = input;
  let mime = mimeType;
  let name = filename;
  if (kind === "image" || kind === "avatar") {
    body = Buffer.from(
      await sharp(input)
        .rotate()
        .resize({ width: kind === "avatar" ? 512 : 2000, height: kind === "avatar" ? 512 : 2000, fit: "inside", withoutEnlargement: true })
        .webp({ quality: 82 })
        .toBuffer(),
    );
    mime = "image/webp";
    name = `${filename.replace(/\.[^.]+$/, "")}.webp`;
  }
  if (isS3Configured()) {
    await s3().send(
      new PutObjectCommand({
        Bucket: env.AWS_S3_BUCKET,
        Key: name,
        Body: body,
        ContentType: mime,
      }),
    );
    return { storagePath: `s3:${name}`, mimeType: mime, size: body.length };
  }
  await mkdir(localRoot(), { recursive: true });
  const safeName = path.basename(name);
  await writeFile(path.join(localRoot(), safeName), body);
  return { storagePath: safeName, mimeType: mime, size: body.length };
};

export const openStored = async (storagePath: string) => {
  if (storagePath.startsWith("s3:")) {
    if (!isS3Configured()) throw new ApiError(503, "File storage is not configured");
    const key = storagePath.slice(3);
    const url = await getSignedUrl(s3(), new GetObjectCommand({ Bucket: env.AWS_S3_BUCKET, Key: key }), { expiresIn: 300 });
    return { redirect: url as string, stream: null, mime: "application/octet-stream" };
  }
  const safeName = path.basename(storagePath);
  const full = path.join(localRoot(), safeName);
  if (!full.startsWith(localRoot())) throw new ApiError(400, "Invalid file path");
  await readFile(full);
  return { redirect: null, stream: createReadStream(full), mime: null as string | null };
};

export const removeStored = async (storagePath: string) => {
  if (storagePath.startsWith("s3:")) {
    if (!isS3Configured()) return;
    await s3().send(new DeleteObjectCommand({ Bucket: env.AWS_S3_BUCKET, Key: storagePath.slice(3) }));
    return;
  }
  await rm(path.join(localRoot(), path.basename(storagePath)), { force: true });
};
