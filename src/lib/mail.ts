import nodemailer from "nodemailer";

export async function sendMail(to: string, subject: string, html: string) {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = (process.env.SMTP_PASS || "").replace(/\s+/g, "");
  const from = process.env.SMTP_FROM || user;
  if (!host || !user || !pass) throw new Error("SMTP is not configured");

  const transporter = nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: false,
    auth: { user, pass },
  });

  await transporter.sendMail({ from, to, subject, html });
}
