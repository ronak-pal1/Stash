import nodemailer from "nodemailer";
import { env, isSmtpConfigured } from "../config/env.js";
import { logger } from "../config/logger.js";

let testTransport: nodemailer.Transporter | null = null;

export const sendMail = async (to: string, subject: string, text: string) => {
  if (env.NODE_ENV !== "production") {
    logger.info({ to, subject, text }, "dev email");
  }
  if (isSmtpConfigured()) {
    const transport = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT ?? 587,
      secure: (env.SMTP_PORT ?? 587) === 465,
      auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
    });
    await transport.sendMail({ from: env.SMTP_FROM, to, subject, text });
    return;
  }
  if (env.NODE_ENV === "production") {
    logger.warn("SMTP is not configured; email was not sent");
    return;
  }
  try {
    if (!testTransport) {
      const account = await nodemailer.createTestAccount();
      testTransport = nodemailer.createTransport({
        host: account.smtp.host,
        port: account.smtp.port,
        secure: account.smtp.secure,
        auth: { user: account.user, pass: account.pass },
      });
    }
    const info = await testTransport.sendMail({
      from: "Stash <noreply@stash.local>",
      to,
      subject,
      text,
    });
    const preview = nodemailer.getTestMessageUrl(info);
    if (preview) logger.info({ preview }, "ethereal preview");
  } catch (error) {
    logger.warn({ err: error }, "ethereal delivery failed; the reset link is in the dev log");
  }
};
