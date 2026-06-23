import { NextResponse } from "next/server";
import { getWarmupConfig, saveWarmupConfig, getWarmupStats } from "../../../../lib/warmupStore";
import { startWarmupScheduler, stopWarmupScheduler, calculateDailyLimit, getSentTodayCount, initiateWarmupSend } from "../../../../lib/warmupScheduler";

export async function GET() {
  try {
    const config = getWarmupConfig();
    const stats = getWarmupStats();
    
    // Auto-start scheduler if configured active but interval is not running
    if (config.active) {
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
      stats
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

    const updates = {};
    if (body.active !== undefined) {
      updates.active = !!body.active;
      if (updates.active && !currentConfig.active) {
        // Turning ON
        updates.startDate = new Date().toISOString();
        startWarmupScheduler();
        // Fire one email immediately to start the warmup loop
        setTimeout(async () => {
          try {
            console.log("[WarmupConfig API] Firing initial warmup email...");
            await initiateWarmupSend();
          } catch (e) {
            console.error("[WarmupConfig API] Error sending initial email:", e);
          }
        }, 1000);
      } else if (!updates.active && currentConfig.active) {
        // Turning OFF
        stopWarmupScheduler();
      }
    }

    if (body.durationDays !== undefined) {
      updates.durationDays = parseInt(body.durationDays, 10) || 14;
    }

    const updatedConfig = saveWarmupConfig(updates);
    const stats = getWarmupStats();
    const currentLimit = calculateDailyLimit(updatedConfig.startDate);
    const sentToday = getSentTodayCount();

    return NextResponse.json({
      success: true,
      config: {
        ...updatedConfig,
        currentLimit,
        sentToday
      },
      stats
    });
  } catch (error) {
    console.error("[WarmupConfig API] POST error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
