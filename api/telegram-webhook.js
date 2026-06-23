import { createClient } from "@supabase/supabase-js";

const ACK_PREFIX = "ack_expiry:";

function getSupabaseClient() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Missing Supabase environment variables");
  }

  return createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

async function callTelegram(method, payload) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) throw new Error("Missing TELEGRAM_BOT_TOKEN");

  const response = await fetch(`https://api.telegram.org/bot${botToken}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  const result = await response.json();
  if (!response.ok || !result.ok) {
    throw new Error(result.description || `Telegram ${method} failed`);
  }

  return result;
}

function removeAcknowledgedButton(replyMarkup, callbackData) {
  const keyboard = replyMarkup?.inline_keyboard;
  if (!Array.isArray(keyboard)) return undefined;

  const inlineKeyboard = keyboard
    .map(row => row.filter(button => button.callback_data !== callbackData))
    .filter(row => row.length > 0);

  return { inline_keyboard: inlineKeyboard };
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (webhookSecret && req.headers["x-telegram-bot-api-secret-token"] !== webhookSecret) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const callbackQuery = req.body?.callback_query;
  const callbackData = callbackQuery?.data;

  if (!callbackQuery || !callbackData?.startsWith(ACK_PREFIX)) {
    return res.status(200).json({ ok: true, ignored: true });
  }

  const itemId = Number(callbackData.slice(ACK_PREFIX.length));
  if (!Number.isInteger(itemId) || itemId <= 0) {
    await callTelegram("answerCallbackQuery", {
      callback_query_id: callbackQuery.id,
      text: "Ürün bilgisi okunamadı.",
      show_alert: true
    });
    return res.status(400).json({ error: "Invalid expiry item id" });
  }

  try {
    const supabase = getSupabaseClient();
    const { error } = await supabase
      .from("expiry_items")
      .update({
        active: false,
        acknowledged_at: new Date().toISOString(),
        acknowledged_note: "Telegram üzerinden kaldırıldı"
      })
      .eq("id", itemId);

    if (error) throw error;

    await callTelegram("answerCallbackQuery", {
      callback_query_id: callbackQuery.id,
      text: "Tamam, bu ürün pasife alındı. Bir daha hatırlatmayacağım.",
      show_alert: false
    });

    const message = callbackQuery.message;
    if (message?.chat?.id && message?.message_id) {
      const replyMarkup = removeAcknowledgedButton(message.reply_markup, callbackData);
      await callTelegram("editMessageReplyMarkup", {
        chat_id: message.chat.id,
        message_id: message.message_id,
        reply_markup: replyMarkup
      }).catch(error => {
        console.warn("Could not edit Telegram message markup", error);
      });
    }

    return res.status(200).json({ ok: true, acknowledged: itemId });
  } catch (error) {
    console.error("Telegram webhook failed", error);

    if (callbackQuery.id) {
      await callTelegram("answerCallbackQuery", {
        callback_query_id: callbackQuery.id,
        text: "Bir hata oluştu, lütfen tekrar deneyin.",
        show_alert: true
      }).catch(() => {});
    }

    return res.status(500).json({ error: "Telegram webhook failed" });
  }
}
