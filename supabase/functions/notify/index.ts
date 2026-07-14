// ============================================================
//  한마음 CAROTE · 이메일 알림 Edge Function
//
//  Database Webhook 이 이 함수를 호출하면 Brevo API로 이메일을 발송합니다.
//  - 새 물품 INSERT  → 카테고리(또는 전체) 구독자에게 알림
//  - 판매중 → 예약중 UPDATE → 판매자에게 예약 알림
//  - 신고 INSERT → 모든 관리자에게 알림
//  - 공지(notify=true) INSERT → 수신 동의 성도 전체
//  - 새 가입(INSERT)/프로필 완성(full_name 채움) → 관리자에게 승인 대기 알림
//    (단, 이미 approved=true 인 주보 초대 가입은 건너뜀)
//  - 승인 완료(profiles approved false→true) → 해당 성도에게 환영 메일
//
//  모든 메일은 공통 셸(shell)로 통일: 테이블 기반·인라인 스타일·480px 카드·
//  상단 오렌지 그라데이션 바·워드마크·큰 제목·본문 #57503F·오렌지 pill CTA·회색 푸터.
// ============================================================

import { createClient } from "npm:@supabase/supabase-js@2";

const SENDER_NAME = "한마음 CAROTE";

// ── 공용 이메일 셸 ────────────────────────────────────────────
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

// 본문 공용 조각
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

    // ── E. 새 가입/프로필 완성(full_name 채움) → 관리자에게 승인 대기 알림 ──
    if (payload?.table === "profiles" && (
         payload.type === "INSERT" ||
         (payload.type === "UPDATE" && !payload.old_record?.full_name && payload.record?.full_name)
       )) {
      const u = payload.record;
      // 이미 승인된 가입(주보 초대)은 승인 대기 알림 불필요 → 스킵
      if (u?.approved === true) return json({ skipped: "already approved" });

      const { data: admins } = await admin
        .from("profiles").select("email, nickname").eq("is_admin", true);
      let sent = 0;
      for (const a of admins ?? []) {
        if (!a.email) continue;
        const ok = await sendEmail(a.email,
          `🔔 가입 승인 대기: ${u.full_name || u.nickname || "새 성도"}`,
          shell(
            "새 가입 신청이 접수됐어요",
            P(`${strong(escapeHtml(a.nickname))}님, 새로운 가입 신청이 들어왔어요. 확인 후 승인해 주세요.`) +
            `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:2px 0 4px">
               <tr><td style="padding:3px 0;font-size:14.5px">이름(실명) &nbsp; ${strong(escapeHtml(u.full_name || "(미입력)"))}</td></tr>
               <tr><td style="padding:3px 0;font-size:14.5px">닉네임 &nbsp; ${strong(escapeHtml(u.nickname || ""))}</td></tr>
               <tr><td style="padding:3px 0;font-size:14.5px;color:#8A7F70">이메일 &nbsp; ${escapeHtml(u.email || "")}</td></tr>
             </table>`,
            { label: "성도 관리에서 승인하기", url: `${siteUrl}/` },
          ));
        if (ok) sent++;
      }
      return json({ sent, kind: "approval_request" });
    }

    // ── F. 승인 완료(false→true) → 해당 성도에게 환영 메일 ────────
    if (
      payload?.table === "profiles" && payload.type === "UPDATE" &&
      payload.old_record?.approved === false && payload.record?.approved === true
    ) {
      const u = payload.record;
      if (!u.email) return json({ sent: 0 });
      const feat = (t: string) => `<tr><td style="padding:6px 0;font-size:14.5px;color:#57503F">${t}</td></tr>`;
      const ok = await sendEmail(u.email,
        `🎉 가입이 승인되었어요`,
        shell(
          "가입이 승인되었어요",
          P(`${strong(escapeHtml(u.nickname || "성도"))}님, 환영합니다! 이제 한마음 CAROTE의 모든 기능을 이용하실 수 있어요.`) +
          `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#FBF1E4;border-radius:12px;margin:6px 0 4px">
             <tr><td style="padding:14px 20px">
               <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                 ${feat("물품 등록과 나눔")}${feat("예약과 거래")}${feat("판매자와 1:1 채팅")}${feat("게시판과 나눔 후기")}
               </table>
             </td></tr>
           </table>` +
          note("함께 나누는 사랑, 진심으로 환영해요."),
          { label: "한마음 CAROTE 시작하기", url: `${siteUrl}/` },
        ));
      return json({ sent: ok ? 1 : 0, kind: "approval_done" });
    }

    // ── D. 공지 발행 → 수신 동의 성도 전체 ──────────────────────
    if (payload?.table === "posts" && payload.type === "INSERT") {
      const post = payload.record;
      if (post.board !== "notice" || !post.notify) return json({ skipped: true });

      const { data: recipients } = await admin
        .from("profiles").select("email, nickname").eq("notice_email", true);

      const excerpt = String(post.content ?? "").slice(0, 400);
      const more = String(post.content ?? "").length > 400 ? "…" : "";
      let sent = 0;
      for (const r of recipients ?? []) {
        if (!r.email) continue;
        const ok = await sendEmail(r.email,
          `📢 [공지] ${post.title}`,
          shell(
            escapeHtml(post.title),
            P(`${strong(escapeHtml(r.nickname))}님, 한마음 CAROTE에 새 공지가 올라왔어요.`) +
            `<p style="white-space:pre-wrap;margin:0;color:#57503F;line-height:1.75">${escapeHtml(excerpt)}${more}</p>` +
            note("공지 이메일은 사이트의 [알림 설정]에서 언제든 끌 수 있어요."),
            { label: "공지 전체 보기", url: `${siteUrl}/?post=${post.id}` },
          ));
        if (ok) sent++;
      }
      return json({ sent });
    }

    // ── C. 신고 접수 → 모든 관리자에게 알림 ──────────────────────
    if (payload?.table === "reports" && payload.type === "INSERT") {
      const r = payload.record;
      const { data: prod } = await admin
        .from("products").select("name").eq("id", r.product_id).maybeSingle();
      const { data: reporter } = await admin
        .from("profiles").select("nickname").eq("id", r.reporter_id).maybeSingle();
      const { data: admins } = await admin
        .from("profiles").select("email, nickname").eq("is_admin", true);

      const prodName = prod?.name ?? "(삭제된 물품)";
      let sent = 0;
      for (const a of admins ?? []) {
        if (!a.email) continue;
        const ok = await sendEmail(a.email,
          `🚨 물품 신고가 접수됐어요: ${prodName}`,
          shell(
            "물품 신고가 접수됐어요",
            P(`${strong(escapeHtml(a.nickname))}님, 물품 신고가 들어왔어요.`) +
            P(`물품 &nbsp; ${strong(escapeHtml(prodName))}`) +
            P(`사유 &nbsp; ${strong(escapeHtml(r.reason))}${r.detail ? ` · ${escapeHtml(r.detail)}` : ""}`) +
            `<p style="margin:0;color:#8A7F70;font-size:14px">신고자 · ${escapeHtml(reporter?.nickname ?? "알 수 없음")}</p>` +
            note("관리자 메뉴의 [신고]에서 처리할 수 있어요."),
            { label: "물품 확인하기", url: `${siteUrl}/?id=${r.product_id}` },
          ));
        if (ok) sent++;
      }
      return json({ sent });
    }

    if (payload?.table !== "products") return json({ skipped: true });

    // ── A. 새 물품 등록 → 구독자에게 알림 ──────────────────────
    if (payload.type === "INSERT") {
      const p = payload.record;

      let categoryName = "기타";
      if (p.category_id) {
        const { data: cat } = await admin
          .from("categories").select("name, emoji")
          .eq("id", p.category_id).maybeSingle();
        if (cat) categoryName = `${cat.emoji} ${cat.name}`;
      }

      let orFilter = "category_id.is.null";
      if (p.category_id) orFilter += `,category_id.eq.${p.category_id}`;

      const { data: subs, error } = await admin
        .from("subscriptions")
        .select("user_id, profiles!inner(email, nickname)")
        .or(orFilter);
      if (error) throw error;

      const seen = new Set<string>();
      const recipients: { email: string; nickname: string }[] = [];
      for (const s of subs ?? []) {
        if (s.user_id === p.seller_id || seen.has(s.user_id)) continue;
        seen.add(s.user_id);
        const prof = s.profiles as unknown as { email: string; nickname: string };
        if (prof?.email) recipients.push(prof);
      }
      if (recipients.length === 0) return json({ sent: 0 });

      const price = Number(p.price) > 0 ? `€${Number(p.price)}` : "무료나눔";
      const img = Array.isArray(p.images) && p.images[0]
        ? `<img src="${p.images[0]}" width="100%" style="display:block;max-width:416px;border-radius:12px;margin:4px 0 14px" alt="" />`
        : "";

      let sent = 0;
      for (const r of recipients) {
        const ok = await sendEmail(r.email,
          `🥕 새 물품이 올라왔어요: ${p.name}`,
          shell(
            escapeHtml(p.name),
            P(`${strong(escapeHtml(r.nickname))}님, 한마음 CAROTE에 새 물품이 등록되었어요.`) +
            `<p style="margin:0 0 12px;color:#8A7F70;font-size:14px">${escapeHtml(categoryName)} &nbsp;·&nbsp; <b style="color:#B5460D">${price}</b></p>` +
            img +
            note("알림을 그만 받으시려면 사이트의 [알림 설정]에서 해제할 수 있어요."),
            { label: "물품 보러 가기", url: `${siteUrl}/?id=${p.id}` },
          ));
        if (ok) sent++;
      }
      return json({ sent });
    }

    // ── B. 예약 발생 (판매중 → 예약중) → 판매자에게 알림 ─────────
    if (
      payload.type === "UPDATE" &&
      payload.old_record?.status === "판매중" &&
      payload.record?.status === "예약중"
    ) {
      const p = payload.record;

      const { data: seller } = await admin
        .from("profiles").select("email, nickname")
        .eq("id", p.seller_id).maybeSingle();
      if (!seller?.email) return json({ sent: 0 });

      let buyerName = "성도";
      if (p.reserved_by) {
        const { data: buyer } = await admin
          .from("profiles").select("nickname")
          .eq("id", p.reserved_by).maybeSingle();
        if (buyer) buyerName = buyer.nickname;
      }

      const ok = await sendEmail(seller.email,
        `🧡 예약이 들어왔어요: ${p.name}`,
        shell(
          "예약이 들어왔어요",
          P(`${strong(escapeHtml(seller.nickname))}님, 올려주신 물품에 예약이 들어왔어요.`) +
          P(`물품 &nbsp; ${strong(escapeHtml(p.name))}`) +
          P(`예약자 &nbsp; ${strong(escapeHtml(buyerName))}님`) +
          P(`주일에 만나 거래를 진행해 주시고, 거래가 끝나면 사이트에서 ${strong("판매완료")}로 바꿔주세요.`),
          { label: "물품 확인하기", url: `${siteUrl}/?id=${p.id}` },
        ));
      return json({ sent: ok ? 1 : 0 });
    }

    return json({ skipped: true });
  } catch (e) {
    console.error(e);
    return json({ error: String(e) }, 500);
  }
});

// ── Brevo 이메일 발송 ──────────────────────────────────────────
async function sendEmail(to: string, subject: string, htmlContent: string) {
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": Deno.env.get("BREVO_API_KEY")!,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      sender: { name: SENDER_NAME, email: Deno.env.get("SENDER_EMAIL")! },
      to: [{ email: to }],
      subject,
      htmlContent,
    }),
  });
  if (!res.ok) console.error("Brevo error:", res.status, await res.text());
  return res.ok;
}

function escapeHtml(s: string) {
  return String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!)
  );
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}
