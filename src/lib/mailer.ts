import nodemailer from 'nodemailer';

function createTransporter() {
  return nodemailer.createTransport({
    host:   process.env.SMTP_HOST,
    port:   Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD,
    },
  });
}

export async function sendPasswordResetEmail(
  to: string,
  name: string,
  token: string,
): Promise<void> {
  const resetLink = `${process.env.APP_URL || 'http://localhost:5173'}/reset-password?token=${token}`;

  await createTransporter().sendMail({
    from:    `"MR Dashboard" <${process.env.SMTP_FROM}>`,
    to,
    subject: 'MR Dashboard — Password Reset',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px;">
        <h2 style="color:#f97316;">MR Dashboard</h2>
        <p>Hi ${name},</p>
        <p>You requested a password reset. Click the button below to set a new password.
           This link expires in <strong>1 hour</strong>.</p>
        <a href="${resetLink}"
           style="display:inline-block;margin:16px 0;padding:12px 24px;
                  background:#f97316;color:#fff;text-decoration:none;
                  border-radius:6px;font-weight:600;">
          Reset Password
        </a>
        <p style="color:#6b7280;font-size:12px;">
          If you did not request this, you can safely ignore this email.
        </p>
        <p style="color:#9ca3af;font-size:11px;">Link: ${resetLink}</p>
      </div>
    `,
  });
}
