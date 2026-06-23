import { getWarmupConfig, saveWarmupConfig, getWarmupContacts, getWarmupLogs, addWarmupLog } from "./warmupStore";
import { getRandomTemplate } from "./warmupTemplates";
import { sendEmail } from "./emailSender";

let schedulerInterval = null;

/**
 * Calculates the current daily limit based on how many days have passed since the start date.
 * - Week 1 (Days 0-7): 5 emails/day
 * - Week 2 (Days 8-14): 10 emails/day
 * - Week 3 (Days 15-21): 15 emails/day
 * - Week 4 (Days 22-28): 20 emails/day
 * - Week 5+ (Days 29+): 30 emails/day
 */
export function calculateDailyLimit(startDateStr) {
  if (!startDateStr) return 5;
  const start = new Date(startDateStr);
  const now = new Date();
  const diffTime = Math.abs(now - start);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays <= 7) return 5;
  if (diffDays <= 14) return 10;
  if (diffDays <= 21) return 15;
  if (diffDays <= 28) return 20;
  return 30; // max limit
}

/**
 * Gets the number of emails initiated today.
 */
export function getSentTodayCount() {
  const logs = getWarmupLogs();
  const today = new Date().toDateString();
  return logs.filter(log => 
    !log.isReply && 
    new Date(log.sentAt).toDateString() === today
  ).length;
}

/**
 * Initiates a new warmup email conversation.
 * It picks a random sender and recipient from the virtual contacts on the authenticated subdomain.
 */
export async function initiateWarmupSend(force = false) {
  const config = getWarmupConfig();
  if (!config.active && !force) {
    console.log("[WarmupScheduler] Warmup is disabled. Skipping.");
    return { success: false, error: "Warmup is inactive" };
  }

  // Check duration
  const startDateStr = config.startDate || new Date().toISOString();
  const start = new Date(startDateStr);
  const now = new Date();
  const diffTime = Math.abs(now - start);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (!force && diffDays > config.durationDays) {
    console.log(`[WarmupScheduler] Warmup duration of ${config.durationDays} days completed. Stopping.`);
    saveWarmupConfig({ active: false });
    return { success: false, error: "Duration completed" };
  }

  const limit = calculateDailyLimit(startDateStr);
  const todayCount = getSentTodayCount();

  if (!force && todayCount >= limit) {
    console.log(`[WarmupScheduler] Daily limit reached (${todayCount}/${limit}). Skipping send.`);
    return { success: false, error: "Daily limit reached" };
  }

  const contacts = getWarmupContacts();
  if (contacts.length < 2) {
    console.error("[WarmupScheduler] Need at least 2 warmup contacts.");
    return { success: false, error: "Insufficient contacts" };
  }

  // Select sender and recipient randomly from virtual contacts
  let senderIndex = Math.floor(Math.random() * contacts.length);
  let recipientIndex = Math.floor(Math.random() * contacts.length);
  while (recipientIndex === senderIndex) {
    recipientIndex = Math.floor(Math.random() * contacts.length);
  }

  const sender = contacts[senderIndex];
  const recipient = contacts[recipientIndex];
  const template = getRandomTemplate();

  // Override the process.env.SENDER_EMAIL temporarily to send from virtual contact
  const originalSenderEmail = process.env.SENDER_EMAIL;
  process.env.SENDER_EMAIL = sender;

  try {
    const result = await sendEmail({
      to: recipient,
      subject: template.subject,
      text: template.body
    });

    if (result.success) {
      addWarmupLog({
        messageId: result.messageId,
        from: sender,
        to: recipient,
        subject: template.subject,
        sentAt: new Date().toISOString(),
        status: "sent",
        isReply: false
      });
      console.log(`[WarmupScheduler] Initiated warmup email from ${sender} to ${recipient}`);
      return { success: true, messageId: result.messageId };
    } else {
      console.error("[WarmupScheduler] Failed to send warmup email:", result.error);
      return { success: false, error: result.error };
    }
  } catch (err) {
    console.error("[WarmupScheduler] Error in send process:", err);
    return { success: false, error: err.message };
  } finally {
    // Restore original sender email
    process.env.SENDER_EMAIL = originalSenderEmail;
  }
}

/**
 * Starts the background interval checks to send emails spaced out during the day.
 */
export function startWarmupScheduler() {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
  }

  console.log("[WarmupScheduler] Starting background scheduler loop...");
  
  // Every 30 minutes, check if we need to send a warmup email.
  // This spaces out the sends throughout the day instead of blasting them all at once.
  const intervalMs = 30 * 60 * 1000; 
  
  schedulerInterval = setInterval(async () => {
    try {
      const config = getWarmupConfig();
      if (config.active) {
        await initiateWarmupSend();
      }
    } catch (error) {
      console.error("[WarmupScheduler] Error in scheduler tick:", error);
    }
  }, intervalMs);
}

/**
 * Stops the background interval checks.
 */
export function stopWarmupScheduler() {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    console.log("[WarmupScheduler] Background scheduler stopped.");
  }
}
