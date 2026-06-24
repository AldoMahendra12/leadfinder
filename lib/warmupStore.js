import fs from "fs";
import path from "path";

// On Vercel, /tmp is per-container but resets on cold starts.
// We seed the initial config from env vars so the cron job knows
// whether warmup is active even after a cold start.
const isVercel = process.env.VERCEL === "1" || process.env.VERCEL_ENV !== undefined;
const DB_PATH = isVercel
  ? path.join("/tmp", "warmup_db.json")
  : path.join(process.cwd(), "data", "warmup_db.json");

// Default virtual warmup contacts on the authenticated subdomain
const DEFAULT_CONTACTS = [
  "alex@reply.supaautomation.agency",
  "sam@reply.supaautomation.agency",
  "taylor@reply.supaautomation.agency",
  "jordan@reply.supaautomation.agency",
  "casey@reply.supaautomation.agency",
  "morgan@reply.supaautomation.agency"
];

/**
 * Build the default config.
 * On Vercel, we seed WARMUP_ACTIVE and WARMUP_START_DATE from env vars
 * so the warmup survives cold starts.
 */
function buildDefaultConfig() {
  return {
    active: process.env.WARMUP_ACTIVE === "true",
    startDate: process.env.WARMUP_START_DATE || null,
    durationDays: parseInt(process.env.WARMUP_DURATION_DAYS || "14", 10),
    dailyLimit: 5,
    currentVolume: 0
  };
}

function ensureDbExists() {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(DB_PATH)) {
    const initialData = {
      config: buildDefaultConfig(),
      contacts: DEFAULT_CONTACTS,
      logs: []
    };
    fs.writeFileSync(DB_PATH, JSON.stringify(initialData, null, 2));
  }
}

function readDb() {
  ensureDbExists();
  try {
    const raw = fs.readFileSync(DB_PATH, "utf8");
    const db = JSON.parse(raw);
    // If we're on Vercel and the file exists but active is false while env says true,
    // re-seed so a cold start doesn't kill the warmup
    if (isVercel && !db.config.active && process.env.WARMUP_ACTIVE === "true") {
      db.config.active = true;
      db.config.startDate = db.config.startDate || process.env.WARMUP_START_DATE || null;
      writeDb(db);
    }
    return db;
  } catch (error) {
    console.error("[WarmupStore] Error reading warmup DB:", error);
    return { config: buildDefaultConfig(), contacts: DEFAULT_CONTACTS, logs: [] };
  }
}

function writeDb(data) {
  ensureDbExists();
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error("[WarmupStore] Error writing warmup DB:", error);
  }
}

export function getWarmupConfig() {
  const db = readDb();
  const defaults = buildDefaultConfig();
  return {
    ...defaults,
    ...db.config
  };
}

export function saveWarmupConfig(newConfig) {
  const db = readDb();
  db.config = {
    ...db.config,
    ...newConfig
  };
  writeDb(db);
  return db.config;
}

export function getWarmupContacts() {
  const db = readDb();
  return Array.isArray(db.contacts) && db.contacts.length > 0 ? db.contacts : DEFAULT_CONTACTS;
}

export function saveWarmupContacts(contacts) {
  const db = readDb();
  db.contacts = contacts;
  writeDb(db);
  return db.contacts;
}

export function getWarmupLogs() {
  const db = readDb();
  return Array.isArray(db.logs) ? db.logs : [];
}

export function addWarmupLog(logEntry) {
  const db = readDb();
  if (!db.logs) db.logs = [];

  const entry = {
    id: logEntry.messageId || `w_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    messageId: logEntry.messageId || null,
    from: logEntry.from,
    to: logEntry.to,
    subject: logEntry.subject,
    sentAt: logEntry.sentAt || new Date().toISOString(),
    openedAt: logEntry.openedAt || null,
    repliedAt: logEntry.repliedAt || null,
    status: logEntry.status || "sent", // sent, opened, replied
    threadId: logEntry.threadId || null,
    isReply: logEntry.isReply || false
  };

  db.logs.push(entry);
  // Keep only the last 500 logs to avoid /tmp overflow
  if (db.logs.length > 500) {
    db.logs = db.logs.slice(-500);
  }
  writeDb(db);
  return entry;
}

export function updateWarmupLog(messageId, updates) {
  const db = readDb();
  if (!db.logs) return null;

  const index = db.logs.findIndex(log => log.messageId === messageId || log.id === messageId);
  if (index === -1) {
    // If not found by exact messageId, try to find a matching thread
    if (updates.subject) {
      const cleanSubject = updates.subject.replace(/^Re:\s*/i, "").trim();
      const threadIndex = db.logs.findIndex(log =>
        log.subject.replace(/^Re:\s*/i, "").trim() === cleanSubject &&
        (log.to === updates.from || log.from === updates.from)
      );
      if (threadIndex !== -1) {
        db.logs[threadIndex] = {
          ...db.logs[threadIndex],
          ...updates,
          id: db.logs[threadIndex].id
        };
        writeDb(db);
        return db.logs[threadIndex];
      }
    }
    return null;
  }

  db.logs[index] = {
    ...db.logs[index],
    ...updates,
    id: db.logs[index].id
  };
  writeDb(db);
  return db.logs[index];
}

export function getWarmupStats() {
  const logs = getWarmupLogs();
  const sent = logs.filter(l => !l.isReply).length;
  const opened = logs.filter(l => l.openedAt !== null).length;
  const replied = logs.filter(l => l.repliedAt !== null).length;

  return {
    totalSent: sent,
    totalOpened: opened,
    totalReplied: replied,
    openRate: sent > 0 ? Math.round((opened / sent) * 100) : 0,
    replyRate: sent > 0 ? Math.round((replied / sent) * 100) : 0
  };
}
