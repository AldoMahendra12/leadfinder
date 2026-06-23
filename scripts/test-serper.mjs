import fs from "fs";
import { searchMapsViaSerper } from "../lib/serper.js";

// Load .env
try {
  if (fs.existsSync(".env")) {
    const envContent = fs.readFileSync(".env", "utf8");
    envContent.split("\n").forEach(line => {
      const match = line.match(/^\s*([\w.\-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        const key = match[1];
        let value = match[2] || "";
        if (value.startsWith('"') && value.endsWith('"')) {
          value = value.slice(1, -1);
        }
        process.env[key] = value;
      }
    });
  }
} catch (e) {}

async function test() {
  console.log("Calling Serper API...");
  try {
    const start = Date.now();
    const results = await searchMapsViaSerper("law firms", "Arrowtown");
    console.log(`Success in ${Date.now() - start}ms! Found ${results.length} places.`);
    console.log("First result:", results[0]);
  } catch (err) {
    console.error("Failed:", err.message);
  }
}

test();
