import { NextResponse } from "next/server";
import { getWarmupConfig, saveWarmupConfig, getWarmupStats } from "../../../../lib/warmupStore";
import { startWarmupScheduler, stopWarmupScheduler, calculateDailyLimit, getSentTodayCount, initiateWarmupSend } from "../../../../lib/warmupScheduler";

export async function GET() {
  try {
    const config = getWarmupConfig();
    const stats = getWarmupStats();

    // On local dev: auto-start scheduler if active
    const isVercel = process.env.VERCEL === "1" || process.env.VERCEL_ENV !== undefined;
    if (!isVercel && config.active) {
      startWarmupScheduler();
    }

    const currentLimit = calculateDailyLimit(config.startDate);
    const sentToday = getSentTodayCount();

    let daysElapsed = 0;
    let daysLeft = config.durationDays;
    if (config.startDate) {
      const start = new Date(config.startDate);
      const now = new Date();
      const diffTime = Math.abs(now - start);
      daysElapsed = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      daysLeft = Math.max(0, config.durationDays - daysElapsed);
    }

    return NextResponse.json({
      success: true,
      config: {
        ...config,
        currentLimit,
        sentToday,
        daysElapsed,
        daysLeft
      },
      stats,
      // Tells the UI whether cron (Vercel) or setInterval (local) is running the warmup
      mode: (process.env.VERCEL === "1" || process.env.VERCEL_ENV !== undefined) ? "vercel-cron" : "local-interval"
    });
  } catch (error) {
    console.error("[WarmupConfig API] GET error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const body = await req.json();
    const currentConfig = getWarmupConfig();
    const isVercel = process.env.VERCEL === "1" || process.env.VERCEL_ENV !== undefined;

    const updates = {};
    let vercelEnvInstructions = null;

    if (body.active !== undefined) {
      updates.active = !!body.active;

      if (updates.active && !currentConfig.active) {
        // Turning ON
        updates.startDate = new Date().toISOString();

        if (!isVercel) {
          // Local dev: use setInterval
          startWarmupScheduler();
          // Fire one immediately
          setTimeout(async () => {
            try {
              console.log("[WarmupConfig API] Firing initial warmup email...");
              await initiateWarmupSend();
            } catch (e) {
              console.error("[WarmupConfig API] Error sending initial email:", e);
            }
          }, 1000);
        } else {
          // On Vercel: the cron will call /api/warmup/trigger every 30 min.
          // We just need WARMUP_ACTIVE=true and WARMUP_START_DATE in env.
          vercelEnvInstructions = {
            WARMUP_ACTIVE: "true",
            WARMUP_START_DATE: updates.startDate,
            WARMUP_DURATION_DAYS: String(body.durationDays || currentConfig.durationDays || 14)
          };
        }

      } else if (!updates.active && currentConfig.active) {
        // Turning OFF
        if (!isVercel) {
          stopWarmupScheduler();
        }
        // On Vercel: user must set WARMUP_ACTIVE=false in Vercel env vars
        if (isVercel) {
          vercelEnvInstructions = {
            WARMUP_ACTIVE: "false"
          };
        }
      }
    }

    if (body.durationDays !== undefined) {
      updates.durationDays = parseInt(body.durationDays, 10) || 14;
    }

    const updatedConfig = saveWarmupConfig(updates);
    const stats = getWarmupStats();
    const currentLimit = calculateDailyLimit(updatedConfig.startDate);
    const sentToday = getSentTodayCount();

    const response = {
      success: true,
      config: {
        ...updatedConfig,
        currentLimit,
        sentToday
      },
      stats,
      mode: isVercel ? "vercel-cron" : "local-interval"
    };

    if (vercelEnvInstructions) {
      response.vercelEnvInstructions = vercelEnvInstructions;
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error("[WarmupConfig API] POST error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
