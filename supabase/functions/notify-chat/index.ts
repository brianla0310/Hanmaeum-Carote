// notify-chat (한마음 CAROTE) — 채팅 이메일 알림 + 접속중(last_seen_at 3분) 스킵
//   모든 메일은 notify와 동일한 공통 셸(shell)로 통일.
import { createClient } from "npm:@supabase/supabase-js@2";

const SENDER_NAME = "한마음 CAROTE";

// ── 공용 이메일 셸 (notify와 동일 디자인) ──────────────────────
function shell(title: string, bodyHtml: string, cta?: { label: string; url: string }): string {
  const btn = cta
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:8px auto 2px">
         <tr><td align="center" style="border-radius:999px;background:#E8641B">
           <a href="${cta.url}" target="_blank" style="display:inline-block;padding:14px 32px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:999px">${cta.label}</a>
         </td></tr>
       </table>`
    : "";
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0;padding:0;background:#FBF1E4">
    <tr><td align="center" style="padding:32px 12px">
      <table role="presentation" width="480" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:480px;background:#FDFBF6;border:1px solid #EDE5D8;border-radius:16px;overflow:hidden">
        <tr><td style="height:5px;font-size:0;line-height:0;background-color:#E8641B;background-image:linear-gradient(90deg,#F0902A,#E8641B,#C24E12)">&nbsp;</td></tr>
        <tr><td style="padding:34px 32px 28px;font-family:'Apple SD Gothic Neo','Malgun Gothic','Segoe UI',sans-serif">
          <div style="font-size:20px;font-weight:800;color:#E8641B;letter-spacing:-0.4px;margin:0 0 20px">한마음 CAROTE</div>
          <h1 style="font-size:22px;font-weight:800;color:#26201A;line-height:1.4;letter-spacing:-0.5px;margin:0 0 16px">${title}</h1>
          <div style="font-size:15px;line-height:1.75;color:#57503F">${bodyHtml}</div>
          ${btn}
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:28px;border-top:1px solid #EDE5D8">
            <tr><td style="padding-top:16px;font-size:12px;color:#8A7F70;text-align:center;line-height:1.6">밀라노 한마음교회 사랑나눔 바자회 · hanmaeumcarote.com</td></tr>
          </table>
        </td></tr>
      </table>
    </td></tr>
  </table>`;
}

const P = (html: string) => `<p style="margin:0 0 12px">${html}</p>`;
const strong = (s: string) => `<b style="color:#26201A">${s}</b>`;
const note = (html: string) => `<p style="margin:14px 0 0;font-size:12.5px;color:#8A7F70;line-height:1.6">${html}</p>`;

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

    // ── 대화 신고 → 관리자 알림 ──────────────────────────────
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
          shell(
            "채팅 신고가 접수됐어요",
            P(`${strong(escapeHtml(a.nickname))}님, 1:1 채팅 신고가 들어왔어요.`) +
            P(`대화 &nbsp; ${strong(escapeHtml(prodName))} 관련`) +
            P(`사유 &nbsp; ${strong(escapeHtml(payload.reason || "미기재"))}`) +
            `<p style="margin:0;color:#8A7F70;font-size:14px">신고자 · ${escapeHtml(reporter?.nickname ?? "알 수 없음")}</p>` +
            note("관리자 메뉴의 [신고된 채팅]에서 대화 내용을 확인할 수 있어요."),
            { label: "신고된 채팅 확인하기", url: `${siteUrl}/` },
          ));
        if (ok) sent++;
      }
      return json({ sent });
    }

    // ── 새 메시지 → 상대방에게 알림 (첫 메시지만) ─────────────
    const { data: conv } = await admin.from("conversations")
      .select("id, product_id, seller_id, buyer_id, seller_read_at, buyer_read_at, products(name)")
      .eq("id", payload.conv_id).maybeSingle();
    if (!conv) return json({ skipped: "no conv" });

    const sender = payload.sender_id as string;
    const recipientId = sender === conv.seller_id ? conv.buyer_id : conv.seller_id;
    if (!recipientId) return json({ skipped: "no recipient" });

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
    const senderName = senderProf?.nickname ?? "상대방";
    const link = `${siteUrl}/?chat=${conv.id}`;
    const ok = await sendEmail(recipient.email,
      `💬 [${prodName}] ${senderProf?.nickname ?? "누군가"}님이 메시지를 보냈어요`,
      shell(
        "새 메시지가 도착했어요",
        P(`${strong(escapeHtml(recipient.nickname))}님, 1:1 채팅에 새 메시지가 도착했어요.`) +
        P(`물품 &nbsp; ${strong(escapeHtml(prodName))}`) +
        P(`보낸 사람 &nbsp; ${strong(escapeHtml(senderName))}님`) +
        note("채팅은 비공개이며, 신고 시에만 관리자가 열람할 수 있어요."),
        { label: "답장하러 가기", url: link },
      ));
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
