# 한마음 CAROTE — 프로젝트 안내서 (CLAUDE.md)

> 이 파일은 Claude Code가 매 세션 시작 시 프로젝트를 즉시 파악하기 위한 안내서입니다.
> 사용자(나서중)와는 **한국어 존댓말**로 대화합니다. 사용자 호칭은 "서중님".

---

## 프로젝트 개요

밀라노 한마음교회의 사랑나눔 바자회 웹앱. 성도들이 물품을 올리고(가격이 아닌 **기부금**),
예약·거래하며, 수익금은 전액 사랑나눔 헌금으로 사용됩니다. 게시판과 1:1 채팅도 있습니다.

**기술 스택**
- 프런트엔드: **단일 파일 `index.html`** (약 2,500줄, HTML+CSS+바닐라 JS 한 파일에 전부)
  - 외부 프레임워크 없음. supabase-js UMD 빌드가 파일에 **인라인**되어 있음(CDN 차단 대비).
  - 배포: GitHub `main` 브랜치 push → **Netlify 자동 배포**.
- 백엔드: **Supabase** (프로젝트 ref `qvjkbpqoztptemympwxy`, eu-central-1)
  - Postgres + RLS, Auth, Storage, Edge Functions, Realtime.
- 이메일: **Brevo** API (발신 `hanmaeumcarote@gmail.com`, Gmail 개별 발신자 인증).

---

## ⚠️ 작업 규칙 (중요)

1. **DB·Edge Function 변경은 Supabase MCP로 직접 적용**한다.
   - MCP 도구는 세션 시작 시 `tool_search`로 로드해야 함 (예: "supabase apply migration").
   - 스키마 변경: `apply_migration` (마이그레이션 이름 + 전체 SQL).
   - 함수 배포: `deploy_edge_function`.
   - 검증·정리: `execute_sql`.
2. **프런트엔드는 `index.html` 한 파일을 직접 수정**한다.
   - 큰 구조 변경이 아니면 문자열 앵커 기반 부분 수정 선호.
   - 수정 후 **반드시** JS 문법 검사: 스크립트 추출 → `node --check`.
3. **모든 변경은 반드시 테스트한다.** Playwright 헤드리스 크롬 사용.
   - **프록시 인증서 때문에 `--ignore-certificate-errors` 플래그 필수.**
   - 로컬 http 서버 띄우고 `file://` 아닌 `http://127.0.0.1:PORT`로 접속.
   - 테스트 계정 생성 시 `@gmail.com` 형식 사용. **테스트 후 반드시 정리**(auth.users 삭제).
4. **관리자 전용 기능**은 서버(RLS/함수)에서 `is_admin()`으로 막는다. 화면 숨김만으로 끝내지 않는다.
5. 사용자에게 코드 전체를 길게 늘어놓지 않는다. 커밋 → push로 배포되므로 **간결하게** 요약.
6. **비밀값**(NOTIFY_SECRET, API 키 등)은 이 파일이나 프런트에 평문으로 새로 노출하지 않는다.
   이미 Supabase Secrets에 등록돼 있음.

---

## 확정된 인프라 값

| 항목 | 값 |
|---|---|
| 서비스 도메인 | `https://hanmaeumcarote.com` (Cloudflare 구매, DNS only로 Netlify 연결) |
| www 처리 | `www.hanmaeumcarote.com` → apex로 301 리다이렉트 (Netlify) |
| Supabase URL | `https://qvjkbpqoztptemympwxy.supabase.co` |
| Supabase ref | `qvjkbpqoztptemympwxy` (eu-central-1) |
| anon publishable key | `sb_publishable_7D5ucUDeHKp6fM0DMfctLw_4VVHs053` (index.html에 삽입됨) |
| 리전 | eu-central-1 |

> **도메인/이메일**: `SITE_URL` secret·Supabase Auth Site URL 모두 `https://hanmaeumcarote.com`로 갱신됨.
> Brevo 도메인 인증(SPF/DKIM) 완료, 발신 주소 `noreply@hanmaeumcarote.com`.
> 프런트의 공유 링크·비밀번호 재설정 redirect는 `location.origin` 기반이라 도메인에 자동 적응(하드코딩 없음).

**관리자 계정 (is_admin=true) 2명**
- 나서중 — `brianla0310@gmail.com` (id `e542c21b-87bf-497d-b8eb-e938557d7959`)
- 당근마켓 관리자 — `hanmaeumcarote@gmail.com`

**Supabase Secrets** (Edge Function에서 `Deno.env.get()`으로 사용)
- `BREVO_API_KEY`, `SENDER_EMAIL`, `SITE_URL`, `NOTIFY_SECRET`
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`는 자동 주입됨.

> **참고**: NOTIFY_SECRET 실제 값은 웹훅 트리거 SQL과 Secrets에 이미 들어있음.
> 새 웹훅 트리거를 SQL로 만들 땐 기존 트리거(`notify_*_webhook`)의 헤더 값을 그대로 참고.

---

## DB 스키마 (public)

### 테이블
- **profiles** `(id, nickname, full_name, email, is_admin, approved, notice_email, notify_setup_done)`
  - `email`·`full_name` 컬럼은 일반 grant 차단(관리자 함수로만 조회 — PII). 가입 시 `handle_new_user` 트리거로 생성.
  - `full_name`: 실명(관리자 승인 확인용, 다른 성도엔 비노출). `approved`: 관리자 승인 여부(기본 false, 기존 회원 전원 true).
  - `notice_email`: 공지 이메일 수신 동의(기본 false). `notify_setup_done`: 가입 후 알림 온보딩 완료 여부.
- **categories** `(id, name, emoji, ...)` — 7개 시드. 무료나눔은 카테고리 아님(price=0이면 💚 무료나눔).
- **products** `(id, name, price, status, description, images[], is_hot, seller_id, reserved_by, sold_at, created_at, category_id)`
  - status: `판매중 | 예약중 | 판매완료`. `seller_id` nullable(탈퇴 익명화용).
  - `sold_at`: 판매완료 전환 시각(트리거 `set_sold_at`). 나눔후기 7일 제한·채팅 자동삭제 기준.
- **subscriptions** `(id, user_id, category_id)` — category_id NULL = 전체 알림.
- **favorites** `(user_id, product_id)` PK 복합. RLS 본인만.
- **reports** `(id, product_id, reporter_id, reason, detail, created_at)` — unique(product_id, reporter_id).
- **site_settings** `(key, value)` — 배너/푸터 문구. 관리자만 쓰기. keys: `banner_eyebrow, banner_label, footer_hand, footer_text`.
- **banned_emails** `(email, reason, created_at)` — 재가입 차단. 관리자만.
- **posts** `(id, board, title, content, images[], author_id, product_id, notify, created_at, updated_at)`
  - board: `notice | free | review`. 공지는 관리자만. 후기(review)는 판매완료 후 7일 이내 구매자만, 물품당 1개(unique index).
- **comments** `(id, post_id, author_id, content, created_at)`
- **conversations** `(id, product_id, seller_id, buyer_id, last_message, last_at, seller_read_at, buyer_read_at, reported, created_at)`
  - unique(product_id, buyer_id). seller/buyer는 SET NULL. **탈퇴 시 명시적으로 삭제 필요**(연쇄 안 됨).
- **messages** `(id, conv_id, sender_id, body, created_at)`

### 함수 (RPC / 트리거)
- `is_admin()` / `is_approved()` — 관리자·승인 여부. SECURITY DEFINER STABLE. 쓰기 RLS·RPC 내부 검증에 사용.
- `handle_new_user()` — 가입 트리거. 차단 이메일 거부 + profiles 생성(metadata의 nickname·full_name 저장, approved=false).
- `admin_approve_member(p_user_id)` — 관리자가 성도 승인(approved=true). is_admin 검증. false→true 시 승인 메일 트리거.
- `reserve_product(p_id)` / `cancel_reservation(p_id)` — 예약/취소. (내부에서 `is_approved()` 검증)
- `set_sold_at()` — 판매완료 시각 트리거.
- `get_or_create_conversation(p_product_id)` — 구매자가 대화방 생성/조회.
- `on_message_insert()` — 메시지 삽입 시 대화방 요약·읽음 갱신 트리거.
- `report_conversation(p_conv_id, p_reason)` — 참여자가 대화 신고(reported=true) + 관리자 알림.
- `admin_resolve_chat(p_conv_id)` — 관리자가 신고 해제. (RLS UPDATE+RETURNING 충돌 회피용 전용 함수)
- `admin_list_members()` — 관리자용 전체 성도 목록(실명·이메일·approved 포함, 미승인 먼저 정렬).
- `admin_list_reported_chats()` — 관리자용 신고된 대화 목록.
- `cleanup_old_chats()` — 판매완료 7일 후 대화 삭제. **pg_cron으로 매일 04:00 실행** (`cron.schedule`).
- `notify_*_webhook()` — products/reports/posts/messages 삽입 시 해당 Edge Function 호출(pg_net, `x-notify-secret` 헤더).
- `notify_profiles_webhook()` — profiles INSERT(가입 승인 대기 알림) / approved false→true UPDATE(승인 완료 알림) → notify 함수 호출.

> **RLS 요약(보안 개편 후)**: 읽기는 **로그인 우선** — products/posts/comments select = `auth.uid() is not null`(site_settings/categories만 공개). 쓰기(products·posts·comments·messages·favorites·reports·subscriptions insert, products update)는 **승인 필요** — `is_approved()` 조건 추가. 단 **본인 profiles UPDATE(알림 설정)는 승인 전에도 허용**. reserve/cancel/get_or_create_conversation/report_conversation RPC도 내부에서 `is_approved()` 검증.

### Storage
- 버킷 `product-images` (public). 업로드 경로 `${user.id}/파일명`. 본인 폴더에만 업로드 가능(RLS).

---

## Edge Functions (`supabase/functions/`)

전부 `npm:@supabase/supabase-js@2` import, `verify_jwt: false`(자체 인증 처리).

- **notify** — products/reports/posts/profiles 웹훅 수신.
  - A) 새 물품 → 구독자 이메일  B) 예약(판매중→예약중) → 판매자
  - C) 신고 접수 → 관리자 전체  D) 공지(notify=true) → 수신동의 성도 전체
  - E) 새 가입(profiles INSERT) → 관리자 전체("가입 승인 대기: 실명/닉네임")
  - F) 승인 완료(approved false→true) → 해당 성도("승인 완료, 이제 이용 가능")
  - `NOTIFY_SECRET` 헤더 검증. Brevo로 발송.
- **notify-chat** — messages/채팅신고 웹훅 수신.
  - 새 메시지 → 상대방에게 알림(단, **상대가 직전에 이미 읽은 상태였을 때만 1통**. 안 읽은 게 쌓여있으면 재발송 안 함)
  - 대화 신고 → 관리자 전체.
- **delete-account** — 본인 탈퇴. JWT 검증 후: 예약 해제 → 판매완료 익명화(seller_id=null, images=[]) → 나머지 물품 삭제 → **대화 삭제** → 스토리지 폴더 삭제 → 계정 삭제. CORS 포함.
- **admin-remove-user** — 관리자 강제 탈퇴. 호출자 관리자 확인 → 관리자/본인 대상 거부 → (ban=true면 banned_emails 추가) → 대상 콘텐츠 정리(delete-account와 동일) → 계정 삭제.

---

## 프런트엔드 (`index.html`) 주요 구조

**뷰 전환**: 상단 탭으로 `🥕 장터` / `💬 게시판` 전환(`switchView`). 관리자는 별도 모달(개편 예정 — 아래 로드맵).

**주요 화면/기능**
- 헤더: 로고(당근+십자가 SVG), 물품 올리기, 💬 채팅(안읽음 배지), 프로필 드롭다운.
- 장터: 통계 배너 + 검색 + 카테고리 칩 + 정렬(최신/기부금순) + 물품 그리드(찜 하트).
- 물품 상세 모달: 이미지, 예약/취소, 판매자에게 문의(채팅), 찜, 공유, 신고, 나눔후기(구매자·7일).
- 내 활동 모달: 내 물품 / 예약한 물품 / 🧡 찜 탭.
- 게시판: 공지 배너 + 카테고리 필터 + 글쓰기(사진 5장) + 글 상세(댓글).
- 채팅: 목록 모달 / 채팅방 모달(Realtime, 신고 버튼, 비공개 안내) / 관리자 열람 모드.
- 알림 설정 모달: 가입 직후 **필수 온보딩**(공지 이메일 + 카테고리별 물품 알림).
- 관리자 모달: 통계 / 신고 물품 / 신고 채팅 / 성도 관리(강제탈퇴·차단) / 문구 / 카테고리.
- PWA: manifest + 아이콘. **서비스워커는 의도적으로 미사용**(stale 캐시 방지).

**아이콘/브랜딩**: 당근+십자가 SVG. 팔레트 — 몸통 `#E8641B`, 결 `#C24E12`, 잎 `#3E7C4F`/`#4C9260`,
십자가 `#FDFBF6`, 배경 `#FBF1E4`. SVG 좌표는 index.html의 PLACEHOLDER 상수와 favicon.svg에 있음.

**배포 파일**(저장소 루트): `index.html`, `favicon.svg`, `manifest.webmanifest`, `icon-192.png`, `icon-512.png`, `apple-touch-icon.png`, `og-image.png`(1200×630 링크 미리보기 카드).

> **OG 미리보기**: `<head>`에 사이트 공통 Open Graph/Twitter 태그 + `og-image.png`(카톡·SNS 카드). 단일 파일 SPA라 크롤러가 JS 실행 전 정적 HTML만 읽으므로 **물품별 개별 미리보기는 불가**(전 링크 공통 카드). og-image.png는 로고 SVG를 캔버스로 렌더해 생성했음.

---

## 개발 워크플로우 (Claude Code)

```bash
# 1. JS 문법 검사 (index.html 수정 후 필수)
#    <script> 마지막 블록 추출해서 검사
python3 -c "import re; open('/tmp/app.js','w').write(re.findall(r'<script>(.*?)</script>', open('index.html').read(), re.S)[-1])"
node --check /tmp/app.js

# 2. Playwright 테스트 예시 (인증서 무시 필수)
#    - http 서버 띄우고 http://127.0.0.1:PORT 접속
#    - launch(args=['--ignore-certificate-errors'])
#    - 테스트 계정은 @gmail.com, 끝나면 auth.users에서 삭제

# 3. 배포: 커밋 + push → Netlify 자동 배포
git add -A && git commit -m "설명" && git push
```

**Supabase MCP 없이 로컬 CLI를 쓸 경우** (선택): `supabase` CLI 링크 필요. 기본은 MCP 사용.

---

## 로드맵 / 백로그

### 진행 예정 (순서)
1. **스프레드시트 판매완료 건 가져오기**(백로그) — 과거 판매완료 건을 CSV/엑셀에서 읽어 products에 익명 판매완료 레코드로 추가, 모금액 합계 반영. 각 건을 익명 처리할지 닉네임 매칭할지 결정 필요.
   → DB 기반(`legacy` 컬럼·관리자 insert 정책)은 판매내역 작업에서 이미 마련됨. 파서만 얹으면 됨.

### 완료된 주요 마일스톤
- 구글시트/카카오톡 구조 → Supabase 전면 재구축(로그인·물품·예약·관리자·이메일).
- 1차: 비밀번호 토글/변경, 찜하기, 정렬, 신고, 회원탈퇴, PWA.
- 2차: 게시판(공지/자유/후기, 댓글, 공지 이메일), 사이트 문구 편집, 성도 관리(강제탈퇴·재가입차단), 가입 후 알림 온보딩.
- 3차: 1:1 채팅(Realtime, 안읽음 배지, 첫 메시지만 이메일, 신고 시 관리자 열람, 7일 후 자동삭제).
- 4차: 관리자 전체화면 뷰 개편(좌측 사이드바/모바일 가로 탭), 판매내역 섹션(과거기록 `legacy`·CSV 내보내기), **커스텀 도메인 `hanmaeumcarote.com` 연결**(Cloudflare DNS only→Netlify) + Brevo 도메인 인증(SPF/DKIM).
- 5차: **보안 개편** — 가입 승인제(`approved`·실명 `full_name`·`admin_approve_member`), 로그인 우선 랜딩(비로그인 랜딩·읽기 RLS `auth.uid() is not null`), 쓰기 RLS·RPC에 `is_approved()`, 승인 대기 화면, 관리자 승인 UI(대기 강조·승인 버튼), 가입 대기·승인 완료 이메일(notify E/F), "로그인 상태 유지" 세션 옵션(sessionStorage 어댑터), 딥링크 로그인 후 이어열기, 이메일 인증 안내·재발송.

### 알려진 한계 (의도적 결정)
- **가입 승인제로 1차 방어**: 아무나 가입해도 관리자 승인 전엔 읽기만 가능(쓰기·예약·채팅·게시 전부 RLS 차단). 승인 없이는 실질 이용 불가.
- 이메일 인증(Confirm email)은 **배포 후 사용자가 대시보드에서 켤 예정**. 꺼진 상태에서도 프런트가 깨지지 않게 처리됨(켜면 가입 후 인증 안내 화면 + 재발송 동작). CAPTCHA 없음.
- 재가입 차단은 이메일 기준(다른 이메일로는 재가입 가능). 강제 탈퇴(=거절)+차단은 기존 흐름 재사용.
- Supabase Auth "유출된 비밀번호 방지"(HaveIBeenPwned) — 켜기 권장(요금제 제한 가능).

---

## 이메일 스팸 주의
도메인 연결 + **Brevo 도메인 인증(SPF/DKIM) 완료**로 발신 도메인이 `hanmaeumcarote.com`(`noreply@hanmaeumcarote.com`)이 되어 스팸 도달률이 개선됨.
다만 초기에는 여전히 스팸함에 들어갈 수 있으니, 필요 시 사용자에게 스팸함 확인·수신 등록을 권고.
