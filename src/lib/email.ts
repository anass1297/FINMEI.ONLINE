import nodemailer from "nodemailer";

type Mail = { to: string; subject: string; html: string; text: string };

export function appUrl(path = "") {
  return `${(process.env.NEXTAUTH_URL || "http://localhost:3000").replace(/\/$/, "")}${path}`;
}

export function smtpConfigured() {
  return Boolean(process.env.SMTP_HOST);
}

export async function sendMail(mail: Mail) {
  if (!smtpConfigured()) {
    // Development fallback: print the email so links can be followed locally.
    console.log(`\n──── [email:dev] to=${mail.to} ────\nSubject: ${mail.subject}\n${mail.text}\n────────────────────────────\n`);
    return;
  }
  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } : undefined,
  });
  await transport.sendMail({ from: process.env.EMAIL_FROM || "FINMEI Financial <no-reply@finmei.online>", ...mail });
}

function layout(title: string, body: string, cta?: { label: string; url: string }) {
  return `<!doctype html><html><body style="margin:0;background:#f6f7fb;font-family:Inter,Segoe UI,Arial,sans-serif;color:#0f172a">
  <div style="max-width:520px;margin:40px auto;background:#fff;border-radius:14px;padding:32px;border:1px solid #e5e7eb">
    <div style="font-weight:700;font-size:18px;margin-bottom:24px"><span style="display:inline-block;width:22px;height:22px;border-radius:6px;background:#4f46e5;vertical-align:middle;margin-right:8px"></span>FINMEI Financial</div>
    <h1 style="font-size:20px;margin:0 0 12px">${title}</h1>
    <div style="font-size:14px;line-height:1.6;color:#334155">${body}</div>
    ${cta ? `<a href="${cta.url}" style="display:inline-block;margin-top:24px;background:#4f46e5;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:600;font-size:14px">${cta.label}</a>
    <p style="font-size:12px;color:#64748b;margin-top:24px;word-break:break-all">Or paste this link: ${cta.url}</p>` : ""}
  </div></body></html>`;
}

export async function sendVerificationEmail(to: string, token: string) {
  const url = appUrl(`/verify-email?token=${encodeURIComponent(token)}`);
  await sendMail({
    to,
    subject: "Verify your FINMEI Financial email",
    text: `Welcome to FINMEI Financial! Verify your email: ${url}\nThis link expires in 24 hours.`,
    html: layout("Confirm your email", "Welcome to FINMEI Financial! Please confirm your email address to activate your account. This link expires in 24 hours.", { label: "Verify email", url }),
  });
}

export async function sendPasswordResetEmail(to: string, token: string) {
  const url = appUrl(`/reset-password?token=${encodeURIComponent(token)}`);
  await sendMail({
    to,
    subject: "Reset your FINMEI Financial password",
    text: `Reset your password: ${url}\nThis link expires in 1 hour. If you didn't request it, ignore this email.`,
    html: layout("Reset your password", "We received a request to reset your password. This link expires in 1 hour. If you didn't request this, you can safely ignore this email.", { label: "Reset password", url }),
  });
}

export async function sendInvoiceEmail(opts: { to: string; businessName: string; number: string; total: string; dueDate: string; url: string; message?: string | null }) {
  await sendMail({
    to: opts.to,
    subject: `Invoice ${opts.number} from ${opts.businessName}`,
    text: `${opts.message ? opts.message + "\n\n" : ""}Invoice ${opts.number} for ${opts.total} is due ${opts.dueDate}.\nView and download: ${opts.url}`,
    html: layout(`Invoice ${opts.number}`, `${opts.message ? `<p>${escapeHtml(opts.message)}</p>` : ""}<p><b>${escapeHtml(opts.businessName)}</b> sent you an invoice for <b>${opts.total}</b>, due <b>${opts.dueDate}</b>.</p>`, { label: "View invoice", url: opts.url }),
  });
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
