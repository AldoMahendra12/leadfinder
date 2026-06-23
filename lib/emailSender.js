import nodemailer from "nodemailer";

/**
 * Sends an email using Brevo SMTP.
 * @param {Object} params
 * @param {string} params.to - Recipient email.
 * @param {string} params.subject - Email subject.
 * @param {string} params.text - Email plain text body.
 * @returns {Promise<{success: boolean, messageId?: string, error?: string}>}
 */
export async function sendEmail({ to, subject, text }) {
  const host = process.env.BREVO_SMTP_HOST || "smtp-relay.brevo.com";
  const port = parseInt(process.env.BREVO_SMTP_PORT || "587", 10);
  const user = process.env.BREVO_SMTP_USER;
  const pass = process.env.BREVO_SMTP_PASS;
  const fromName = process.env.SENDER_NAME || "Supa Automation";
  const fromEmail = process.env.SENDER_EMAIL;

  if (!user || !pass || !fromEmail) {
    console.error("[EmailSender] Missing Brevo SMTP credentials or Sender Email.");
    return { success: false, error: "SMTP credentials or Sender Email not configured." };
  }

  // Create transporter
  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465, // true for 465, false for other ports
    auth: {
      user,
      pass,
    },
  });

  try {
    console.log(`[EmailSender] Sending email to ${to} with subject "${subject}"`);
    const info = await transporter.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to,
      subject,
      text, // Plain text only
    });

    console.log(`[EmailSender] Email sent successfully. Message ID: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error(`[EmailSender] Failed to send email to ${to}:`, error);
    return { success: false, error: error.message };
  }
}
