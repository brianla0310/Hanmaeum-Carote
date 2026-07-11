// ============================================================
//  한마음 CAROTE · 채팅 이메일 알림 Edge Function
//  - 새 메시지: 상대방이 "직전에 이미 읽은 상태"였을 때만 1통 발송
//    (안 읽은 메시지가 쌓여 있는 동안에는 추가 발송하지 않음)
//  - 상대가 최근 3분 이내 접속 중이면(last_seen_at) 인앱 알림/소리로 충분하므로 스킵
//  - 대화 신고: 모든 관리자에게 알림
// ============================================================
import { createClient } from "npm:@supabase/supabase-js@2";

const SENDER_NAME = "한마음 CAROTE";

Deno.serve(async (req) => {
  try {
    const secret = Deno.env.get("NOTIFY_SECRET") ?? "";
    if (secret && req.headers.get("x-notify-secret") !== secret) {
      return json({ error: "unauthorized" }, 401);
    }
    const payload = await req.json();
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const siteUrl = (Deno.env.get("SITE_URL") ?? "").replace(/\/$/, "");

    // ── 대화 신고 → 관리자 알림 ──────────────────────────
    if (payload?.chat_report) {
      const { data: conv } = await admin.from("conversations")
        .select("id, product_id, products(name)")
        .eq("id", payload.conv_id).maybeSingle();
      const { data: reporter } = await admin.from("profiles")
        .select("nickname").eq("id", payload.reporter_id).maybeSingle();
      const { data: admins } = await admin.from("profiles")
        .select("email, nickname").eq("is_admin", true);

      const prodName = (conv?.products as { name?: string } | null)?.name ?? "(삭제된 물품)";
      let sent = 0;
      for (const a of admins ?? []) {
        if (!a.email) continue;
        const ok = await sendEmail(a.email,
          `🚨 채팅 신고가 접수됐어요: ${prodName}`,
          `<div style="font-family:sans-serif;line-height:1.6;color:#26201a">
            <p>${escapeHtml(a.nickname)}님, 1:1 채팅 신고가 접수되었습니다.</p>
            <h2 style="margin:8px 0 4px">${escapeHtml(prodName)} 관련 대화</h2>
            <p style="margin:0">사유: <b>${escapeHtml(payload.reason || "미기재")}</b></p>
            <p style="margin:0;color:#8a7f70">신고자: ${escapeHtml(reporter?.nickname ?? "알 수 없음")}</p>
            <p style="margin-top:12px">관리자 메뉴의 <b>[신고된 채팅]</b>에서 대화 내용을 확인하실 수 있습니다.</p>
            <p><a href="${siteUrl}" style="background:#e8641b;color:#fff;padding:10px 20px;border-radius:999px;text-decoration:none;font-weight:bold">사이트 열기</a></p>
          </div>`);
        if (ok) sent++;
      }
      return json({ sent });
    }

    // ── 새 메시지 → 상대방에게 알림 (첫 메시지만) ─────────
    const { data: conv } = await admin.from("conversations")
      .select("id, product_id, seller_id, buyer_id, seller_read_at, buyer_read_at, products(name)")
      .eq("id", payload.conv_id).maybeSingle();
    if (!conv) return json({ skipped: "no conv" });

    const sender = payload.sender_id as string;
    const recipientId = sender === conv.seller_id ? conv.buyer_id : conv.seller_id;
    if (!recipientId) return json({ skipped: "no recipient" });

    // 이 메시지 직전에 이 방에 존재하던 메시지 수 (방금 것 제외).
    // 상대가 안 읽은 메시지가 이미 있었다면(=unreadBefore>0) 재알림하지 않음.
    const recipientReadAt = sender === conv.seller_id ? conv.buyer_read_at : conv.seller_read_at;
    const { count: unreadBefore } = await admin.from("messages")
      .select("*", { count: "exact", head: true })
      .eq("conv_id", conv.id)
      .neq("sender_id", recipientId)
      .lt("id", payload.message_id)
      .gt("created_at", recipientReadAt);
    if ((unreadBefore ?? 0) > 0) return json({ skipped: "already has unread" });

    const { data: recipient } = await admin.from("profiles")
      .select("email, nickname, last_seen_at").eq("id", recipientId).maybeSingle();

    // 상대가 최근 3분 이내 접속 중이면 인앱 알림·소리로 충분 → 이메일 스킵
    if (recipient?.last_seen_at &&
        Date.now() - new Date(recipient.last_seen_at).getTime() < 3 * 60 * 1000) {
      return json({ skipped: "recipient online" });
    }
    if (!recipient?.email) return json({ skipped: "no email" });

    const { data: senderProf } = await admin.from("profiles")
      .select("nickname").eq("id", sender).maybeSingle();

    const prodName = (conv.products as { name?: string } | null)?.name ?? "물품";
    const link = `${siteUrl}/?chat=${conv.id}`;
    const ok = await sendEmail(recipient.email,
      `💬 [${prodName}] ${senderProf?.nickname ?? "누군가"}님이 메시지를 보냈어요`,
      `<div style="font-family:sans-serif;line-height:1.6;color:#26201a">
        <p>${escapeHtml(recipient.nickname)}님, 1:1 채팅에 새 메시지가 도착했습니다.</p>
        <h2 style="margin:8px 0 4px">${escapeHtml(prodName)}</h2>
        <p style="margin:0;color:#8a7f70"><b>${escapeHtml(senderProf?.nickname ?? "상대방")}</b>님과의 대화</p>
        <p><a href="${link}" style="background:#e8641b;color:#fff;padding:10px 20px;border-radius:999px;text-decoration:none;font-weight:bold">답장하러 가기</a></p>
        <p style="font-size:12px;color:#8a7f70">채팅은 비공개이며, 신고 시에만 관리자가 열람할 수 있습니다.</p>
      </div>`);
    return json({ sent: ok ? 1 : 0 });
  } catch (e) {
    console.error(e);
    return json({ error: String(e) }, 500);
  }
});

async function sendEmail(to: string, subject: string, htmlContent: string) {
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": Deno.env.get("BREVO_API_KEY")!, "content-type": "application/json" },
    body: JSON.stringify({
      sender: { name: SENDER_NAME, email: Deno.env.get("SENDER_EMAIL")! },
      to: [{ email: to }], subject, htmlContent,
    }),
  });
  if (!res.ok) console.error("Brevo error:", res.status, await res.text());
  return res.ok;
}
function escapeHtml(s: string) {
  return String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}
