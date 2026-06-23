import fs from "fs";
import path from "path";

const DB_PATH = path.join(process.cwd(), "data", "warmup_db.json");

// Default virtual warmup contacts on the authenticated subdomain
const DEFAULT_CONTACTS = [
  "alex@reply.supaautomation.agency",
  "sam@reply.supaautomation.agency",
  "taylor@reply.supaautomation.agency",
  "jordan@reply.supaautomation.agency",
  "casey@reply.supaautomation.agency",
  "morgan@reply.supaautomation.agency"
];

function ensureDbExists() {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(DB_PATH)) {
    const initialData = {
      config: {
        active: false,
        startDate: null,
        durationDays: 14,
        dailyLimit: 5,
        currentVolume: 0
      },
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
    return JSON.parse(raw);
  } catch (error) {
    console.error("[WarmupStore] Error reading warmup DB:", error);
    return { config: {}, contacts: [], logs: [] };
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
  // Ensure default structure
  return {
    active: false,
    startDate: null,
    durationDays: 14,
    dailyLimit: 5,
    currentVolume: 0,
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
