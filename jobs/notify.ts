// ntfy.sh ile telefona bildirim. Konu adı gizli tutulur (GitHub Secrets); mesajda yalnızca işletme adı ve saat bulunur.

const TIMEOUT_MS = 10_000;

export function isNotifyConfigured(): boolean {
  return Boolean(process.env.NTFY_TOPIC?.trim());
}

export async function sendNotification(input: { title: string; message: string; clickUrl?: string }): Promise<void> {
  const base = (process.env.NTFY_URL?.trim() || "https://ntfy.sh").replace(/\/$/, "");
  const topic = process.env.NTFY_TOPIC!.trim();
  const headers: Record<string, string> = {
    // Başlıklar ASCII olmalı; Türkçe başlık RFC 2047 ile kodlanır.
    Title: `=?UTF-8?B?${Buffer.from(input.title, "utf8").toString("base64")}?=`,
    Priority: "high",
    Tags: "calendar",
  };
  if (input.clickUrl) headers.Click = input.clickUrl;
  if (process.env.NTFY_TOKEN?.trim()) headers.Authorization = `Bearer ${process.env.NTFY_TOKEN.trim()}`;
  const res = await fetch(`${base}/${encodeURIComponent(topic)}`, {
    method: "POST",
    headers,
    body: input.message,
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`ntfy HTTP ${res.status}`);
}
