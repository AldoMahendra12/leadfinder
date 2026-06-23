import fs from 'fs';
import path from 'path';

// Manual .env parser to avoid external dependencies
function loadEnv() {
  const envPath = path.join(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) {
    console.error("❌ .env file not found");
    process.exit(1);
  }
  const envContent = fs.readFileSync(envPath, 'utf8');
  const env = {};
  envContent.split(/\r?\n/).forEach(line => {
    // skip comments
    if (line.trim().startsWith('#')) return;
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      const key = match[1];
      let value = match[2] || '';
      // strip quotes if present
      if (value.startsWith('"') && value.endsWith('"')) {
        value = value.slice(1, -1);
      } else if (value.startsWith("'") && value.endsWith("'")) {
        value = value.slice(1, -1);
      }
      env[key] = value.trim();
    }
  });
  return env;
}

const env = loadEnv();
const brevoApiKey = env.BREVO_API_KEY || env.BREVO_SMTP_PASS;
const domain = "reply.supaautomation.agency";
// Use the ngrok URL shown in your browser screenshot
const webhookUrl = "https://hexagram-ploy-unpaid.ngrok-free.dev/api/warmup/inbound";

if (!brevoApiKey) {
  console.error("❌ Missing BREVO_SMTP_PASS in .env file.");
  process.exit(1);
}

async function registerWebhook() {
  const apiUrl = "https://api.brevo.com/v3/webhooks";
  const payload = {
    type: "inbound",
    events: ["inboundEmailProcessed"],
    url: webhookUrl,
    description: "Automated Cold Outreach Warmup Loop Webhook",
    domain: domain
  };

  console.log(`[WebhookRegister] API Key (First 4 chars): ${brevoApiKey.substring(0, 4)}...`);
  console.log(`[WebhookRegister] URL: ${webhookUrl}`);
  console.log(`[WebhookRegister] Subdomain: ${domain}`);
  console.log(`[WebhookRegister] Registering webhook via Brevo API V3...`);

  try {
    const res = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "api-key": brevoApiKey,
        "content-type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const data = await res.json();

    if (res.ok) {
      console.log("\n✅ SUCCESS: Webhook registered in Brevo successfully!");
      console.log("Details:", JSON.stringify(data, null, 2));
    } else {
      console.error("\n❌ FAILED to register webhook:");
      console.error("HTTP Status:", res.status);
      console.error("Response:", JSON.stringify(data, null, 2));
      console.error("\nIf the error says domain is not verified, make sure 'reply.supaautomation.agency' (or root) is added and verified in your Brevo Sender Domains.");
    }
  } catch (error) {
    console.error("❌ Request Error:", error.message);
  }
}

registerWebhook();
