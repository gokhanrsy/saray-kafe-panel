# Saray Kafe POS Panel

Kafe için masa, paket, gel-al, ürün, stok, rapor ve son kullanma tarihi yönetim paneli.

## Kurulum

1. Projeyi Vercel'e aktarın.
2. Vercel Environment Variables bölümüne istemci değişkenlerini ekleyin:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_PANEL_PASSWORD`
3. Supabase proje URL'sini ve anahtarlarını Project Settings > API bölümünden alın.

## SKT takip kurulumu

1. `supabase/expiry_items.sql` dosyasını Supabase SQL Editor'da çalıştırın.
2. Vercel Environment Variables bölümüne sunucu değişkenlerini ekleyin:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `TELEGRAM_BOT_TOKEN`
   - `TELEGRAM_CHAT_ID`
   - `CRON_SECRET`
3. `vercel.json`, `/api/check-expiry` endpoint'ini her gün 06:00 UTC'de (İstanbul 09:00) çağırır.

Endpoint yalnızca `Authorization: Bearer <CRON_SECRET>` başlığıyla çalışır ve SKT'sine
0, 1, 2, 3 veya 7 gün kalan aktif ürünleri Telegram'a gönderir.
