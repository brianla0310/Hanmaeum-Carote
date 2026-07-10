// ============================================================
//  한마음 CAROTE · 주보 QR 초대 가입 Edge Function
//  - 주보에 인쇄된 초대 QR(?invite=CODE)로 접속한 어르신이
//    이메일 인증·관리자 승인 없이 바로 가입·이용하도록 처리.
//  - 흐름:
//    1) 초대 활성(invite_enabled) + 코드 일치 확인 (불일치 → 403, 사유 비노출)
//    2) 차단 이메일 사전 확인 (한국어 안내)
//    3) admin.createUser(email_confirm:true) 로 계정 생성
//       (handle_new_user 트리거가 profiles 생성)
//    4) profiles.approved=true, joined_via='invite' 로 갱신 → 바로 이용 가능
//  - verify_jwt=false: 로그인 없이 호출되며, 초대 코드로 자체 인증.
// ============================================================
import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const body = await req.json().catch(() => ({}));
    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");
    const full_name = String(body.full_name ?? "").trim();
    const nickname = String(body.nickname ?? "").trim();
    const code = String(body.code ?? "").trim();

    // 입력 검증
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return json({ error: "이메일 형식을 확인해주세요." }, 400);
    if (password.length < 6)
      return json({ error: "비밀번호는 6자 이상으로 입력해주세요." }, 400);
    if (!full_name || !nickname)
      return json({ error: "이름과 닉네임을 모두 입력해주세요." }, 400);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // 1) 초대 활성 + 코드 일치 확인 (사유는 노출하지 않고 하나의 403로)
    const { data: settings } = await admin.from("site_settings")
      .select("key, value").in("key", ["invite_enabled", "invite_code"]);
    const map = Object.fromEntries((settings ?? []).map((r) => [r.key, r.value]));
    const ok = map["invite_enabled"] === "true"
      && !!code && map["invite_code"] === code;
    if (!ok)
      return json({ error: "초대 링크가 유효하지 않거나 만료됐어요. 일반 가입으로 진행해주세요." }, 403);

    // 2) 차단 이메일 사전 확인 (트리거도 막지만, 깔끔한 한국어 메시지를 위해 먼저 확인)
    const { data: banned } = await admin.from("banned_emails")
      .select("email").ilike("email", email).maybeSingle();
    if (banned)
      return json({ error: "이 이메일은 재가입이 제한되어 있어요. 관리자에게 문의해주세요." }, 403);

    // 3) 계정 생성 (이메일 인증 완료 상태) — 트리거가 profiles 생성
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { nickname, full_name },
    });
    if (createErr || !created?.user) {
      const msg = String(createErr?.message ?? "").toLowerCase();
      if (msg.includes("already") || msg.includes("registered") || msg.includes("exists"))
        return json({ error: "이미 가입된 이메일이에요. 로그인해주세요." }, 409);
      if (msg.includes("banned"))
        return json({ error: "이 이메일은 재가입이 제한되어 있어요. 관리자에게 문의해주세요." }, 403);
      if (msg.includes("password"))
        return json({ error: "비밀번호는 6자 이상으로 입력해주세요." }, 400);
      console.error("createUser failed:", createErr);
      return json({ error: "가입 처리 중 문제가 생겼어요. 잠시 후 다시 시도해주세요." }, 500);
    }

    // 4) 승인·초대 표시 갱신 → 바로 이용 가능
    const { error: updErr } = await admin.from("profiles")
      .update({ approved: true, joined_via: "invite" })
      .eq("id", created.user.id);
    if (updErr) {
      console.error("profile update failed:", updErr);
      // 계정은 생겼으나 승인 갱신 실패 → 관리자 승인으로 이용 가능하므로 성공 처리하되 로그 남김
    }

    return json({ ok: true });
  } catch (e) {
    console.error(e);
    return json({ error: "가입 처리 중 문제가 생겼어요. 잠시 후 다시 시도해주세요." }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "content-type": "application/json" },
  });
}
