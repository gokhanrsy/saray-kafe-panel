const { createClient } = require("@supabase/supabase-js");

const TARGET_DAYS = new Set([0, 1, 2, 3, 7]);

function getIstanbulDateParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function addDays(dateValue, days) {
  const [year, month, day] = dateValue.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
}

function daysBetween(start, end) {
  return Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86400000);
}

function formatMessage(items, today) {
  const sorted = [...items].sort((a, b) => a.expiry_date.localeCompare(b.expiry_date));
  const lines = sorted.map(item => {
    const days = daysBetween(today, item.expiry_date);
    const timing = days === 0 ? "BUGÜN" : `${days} gün kaldı`;
    return `• ${item.product_name} (${item.quantity} adet, ${item.location}) — ${timing}`;
  });

  return [`⚠️ Saray Kafe SKT Uyarısı`, "", ...lines].join("\n");
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || req.headers.authorization !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!supabaseUrl || !supabaseKey || !botToken || !chatId) {
    return res.status(500).json({ error: "Missing server environment variables" });
  }

  try {
    const today = getIstanbulDateParts();
    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
    const { data, error } = await supabase
      .from("expiry_items")
      .select("product_name,quantity,location,expiry_date")
      .eq("active", true)
      .gte("expiry_date", today)
      .lte("expiry_date", addDays(today, 7));

    if (error) throw error;

    const matches = (data || []).filter(item => TARGET_DAYS.has(daysBetween(today, item.expiry_date)));
    if (matches.length === 0) {
      return res.status(200).json({ ok: true, notified: 0, message: "No matching expiry items" });
    }

    const telegramResponse = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: formatMessage(matches, today) })
    });
    const telegramResult = await telegramResponse.json();
    if (!telegramResponse.ok || !telegramResult.ok) {
      throw new Error(telegramResult.description || "Telegram request failed");
    }

    return res.status(200).json({ ok: true, notified: matches.length });
  } catch (error) {
    console.error("Expiry check failed", error);
    return res.status(500).json({ error: "Expiry check failed" });
  }
};
