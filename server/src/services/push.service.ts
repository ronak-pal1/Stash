import webpush from "web-push";
import { env, isPushConfigured } from "../config/env.js";
import { logger } from "../config/logger.js";
import { PushSubscription } from "../models/pushSubscription.model.js";

let configured = false;

const ensure = () => {
  if (!isPushConfigured() || configured) return isPushConfigured();
  webpush.setVapidDetails(env.VAPID_SUBJECT, env.VAPID_PUBLIC_KEY ?? "", env.VAPID_PRIVATE_KEY ?? "");
  configured = true;
  return true;
};

export const publicVapidKey = () => (isPushConfigured() ? env.VAPID_PUBLIC_KEY : null);

export const saveSubscription = async (userId: string, subscription: { endpoint: string; keys: { p256dh: string; auth: string } }) => {
  await PushSubscription.findOneAndUpdate(
    { endpoint: subscription.endpoint },
    { userId, endpoint: subscription.endpoint, p256dh: subscription.keys.p256dh, auth: subscription.keys.auth },
    { upsert: true },
  );
};

export const sendPush = async (userId: string, payload: { title: string; body: string; noteId?: string }) => {
  if (!ensure()) return;
  const subs = await PushSubscription.find({ userId });
  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify(payload),
        );
      } catch (error) {
        logger.warn({ err: error }, "push failed");
        const status = typeof error === "object" && error && "statusCode" in error ? Number(error.statusCode) : 0;
        if (status === 404 || status === 410) await PushSubscription.deleteOne({ _id: sub._id });
      }
    }),
  );
};
