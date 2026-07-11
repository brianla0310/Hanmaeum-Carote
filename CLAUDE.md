# 한마음 CAROTE — 프로젝트 안내서 (CLAUDE.md)

> 이 파일은 Claude Code가 매 세션 시작 시 프로젝트를 즉시 파악하기 위한 안내서입니다.
> 사용자(나서중)와는 **한국어 존댓말**로 대화합니다. 사용자 호칭은 "서중님".

---

## 프로젝트 개요

밀라노 한마음교회의 사랑나눔 바자회 웹앱. 성도들이 물품을 올리고(가격이 아닌 **기부금**),
예약·거래하며, 수익금은 전액 사랑나눔 헌금으로 사용됩니다. 게시판과 1:1 채팅도 있습니다.

> **교회 정식 명칭(개인정보 처리 책임자)**: **Chiesa Cristiana Evangelica Hanmaum di Milano** (밀라노 한마음교회).
> GDPR 개인정보 처리방침은 `privacy.html`(정적 페이지), 연락처 `hanmaeumcarote@gmail.com`.

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
- **profiles** `(id, nickname, full_name, email, is_admin, approved, notice_email, notify_setup_done, joined_via, avatar_url, badge, created_at)`
  - `email`·`full_name` 컬럼은 일반 grant 차단(관리자 함수로만 조회 — PII). 가입 시 `handle_new_user` 트리거로 생성. 컬럼별 grant 방식(민감 컬럼은 grant 안 함).
  - `full_name`: 실명(관리자 승인 확인용, 다른 성도엔 비노출). `approved`: 관리자 승인 여부(기본 false, 기존 회원 전원 true).
  - `notice_email`: 공지 이메일 수신 동의(기본 false). `notify_setup_done`: 가입 후 알림 온보딩 완료 여부.
  - `joined_via`: 가입 경로 `email|google|invite`(기본 'email', handle_new_user가 provider로 분기, 주보 초대 가입은 edge에서 'invite').
  - `avatar_url`: 프로필 사진 URL(공개 read, 본인 update). `badge`: 대표 배지 id(null=자동 최고 달성 배지, 공개 read·본인 update). 둘 다 `profiles_update_own`(auth.uid()=id)로 본인만 수정.
- **categories** `(id, name, emoji, ...)` — 7개 시드. 무료나눔은 카테고리 아님(price=0이면 💚 무료나눔).
- **products** `(id, name, price, status, description, images[], is_hot, seller_id, reserved_by, sold_at, donated_at, created_at, category_id, legacy)`
  - status: `판매중 | 예약중 | 판매완료`. `seller_id` nullable(탈퇴 익명화용).
  - `sold_at`: 판매완료 전환 시각(트리거 `set_sold_at`). 나눔후기 7일 제한·채팅 자동삭제 기준.
  - `donated_at`: **기부완료 시각**. 모금액(renderStats·목표 게이지·대시보드)은 **donated_at 있는 건만 합산**(판매완료≠모금 반영). legacy 과거기록은 자동 donated. 관리자가 판매내역에서 토글.
  - **status 변경은 판매자 본인만**(트리거 `enforce_status_change`): 직접 UPDATE로 status 바꾸면 판매자만 허용(관리자·구매자 불가). 예약/취소/관리자정정 RPC는 GUC `app.allow_status_change` 플래그로 통과.
- **subscriptions** `(id, user_id, category_id)` — category_id NULL = 전체 알림.
- **favorites** `(user_id, product_id)` PK 복합. RLS 본인만.
- **reports** `(id, product_id, reporter_id, reason, detail, created_at)` — unique(product_id, reporter_id).
- **site_settings** `(key, value)` — 배너/푸터 문구·모금 목표·주보 초대. 관리자만 쓰기. keys: `banner_eyebrow, banner_label, footer_hand, footer_text, goal_enabled('true'/'false'), goal_amount(숫자 문자열), invite_enabled('true'/'false'), invite_code(랜덤 12자)`.
  - **invite_code 는 공개 SELECT 차단**(RLS `settings_select`: `key<>'invite_code' or is_admin()`) — 관리자만 조회. 나머지 키는 공개. 프런트는 `invite_status(code)` RPC로 코드 노출 없이 유효성만 확인.
- **banned_emails** `(email, reason, created_at)` — 재가입 차단. 관리자만.
- **posts** `(id, board, title, content, images[], author_id, product_id, notify, created_at, updated_at)`
  - board: `notice | free | review`. 공지는 관리자만. 후기(review)는 판매완료 후 7일 이내 구매자만, 물품당 1개(unique index).
- **comments** `(id, post_id, author_id, content, created_at)`
- **conversations** `(id, product_id, seller_id, buyer_id, last_message, last_at, seller_read_at, buyer_read_at, reported, created_at)`
  - unique(product_id, buyer_id). seller/buyer는 SET NULL. **탈퇴 시 명시적으로 삭제 필요**(연쇄 안 됨).
- **messages** `(id, conv_id, sender_id, body, created_at)`
- **notifications** `(id bigint, user_id→profiles cascade, type, title, body, link_kind, link_id, read, created_at)` — 인앱 알림. RLS: 본인 select + `read`만 update. **클라이언트 insert 불가**(정의자 트리거만 생성). index(user_id, created_at desc). realtime publication 포함. 30일 후 `cleanup_old_chats()`가 삭제.
  - `link_kind`: `product | post | conv | admin_members | admin_reports`. 프론트가 이걸로 대상 열기.
- **profiles.notif_seen_at** timestamptz — 종을 마지막으로 연 시각(빨간 점 기준). 본인 update grant.
- **profiles.last_seen_at** timestamptz default now() — 접속 하트비트(본인 update grant, SELECT는 미부여). 프런트가 로그인 직후·visibilitychange(보임)·2분마다(숨김 탭 정지) 갱신. notify-chat이 3분 이내면 채팅 이메일 스킵.

### 함수 (RPC / 트리거)
- `is_admin()` / `is_approved()` — 관리자·승인 여부. SECURITY DEFINER STABLE. 쓰기 RLS·RPC 내부 검증에 사용.
- `handle_new_user()` — 가입 트리거. 차단 이메일 거부 + profiles 생성(approved=false). **full_name은 이메일 가입(provider=email)만 저장**, OAuth(google)는 null(→ 프론트 프로필 완성 모달). nickname은 metadata nickname→Google name→'성도' 순. `joined_via`=provider('email'/'google').
- `admin_approve_member(p_user_id)` — 관리자가 성도 승인(approved=true). is_admin 검증. false→true 시 승인 메일 트리거.
- `admin_rotate_invite()` — 관리자 주보 초대 코드 교체(랜덤 12자 생성·저장·반환). is_admin 검증. `_gen_invite_code()`(정의자, 혼동문자 제외 31자 알파벳) 사용.
- `invite_status(p_code)` — 초대 코드 유효성만 반환(invite_enabled='true' && code 일치). 정의자·anon 실행 허용, **코드는 노출 안 함**. 프런트 배지/만료 판단용.
- `complete_profile(p_full_name, p_nickname)` — 본인 실명·닉네임 저장(구글 로그인 후 프로필 완성). full_name UPDATE 권한이 없어 정의자 함수로 처리.
- `get_my_profile()` — 본인 프로필 조회(full_name·notif_seen_at·avatar_url·badge·created_at 포함). full_name은 SELECT 차단이라 프론트 `loadProfile`이 이 RPC로 실명·프로필 정보 판단.
- `member_stats()` — 성도별 활동 집계(sold_count·received_count·review_count·joined_year). **횟수·가입연도만**(금액·이메일 등 민감정보 없음). 정의자·authenticated 실행. 프론트가 1회 로드해 배지 계산(판매자·작성자 대표배지).
- `_add_notif(user,type,title,body,link_kind,link_id)` — 인앱 알림 생성 헬퍼(정의자).
- `notif_*()` 트리거 — 인앱 알림 생성(본인 행동엔 안 만듦, `is distinct from auth.uid()`): products(예약/취소/판매완료→판매자·구매자), comments(→글쓴이, 본인 제외), posts review(→판매자), reports·conversations 신고(→관리자), profiles 실명 채워짐(→관리자, 이메일 트리거와 별개).
- `reserve_product(p_id)` / `cancel_reservation(p_id)` — 예약/취소. `is_approved()` 검증 + **셀프예약 차단**(seller=uid → OWN_PRODUCT). 내부에서 `set_config('app.allow_status_change','1')`로 status 변경 트리거 통과.
- `admin_set_status(p_id, p_status)` — 관리자 상태 정정(운영 대응 전용). is_admin 검증 + GUC 플래그. 판매내역 '상태 정정' 버튼.
- `admin_set_donated(p_id, v)` — 관리자 기부완료 토글(판매완료 건만, donated_at 설정/해제). is_admin 검증.
- `enforce_status_change()` — BEFORE UPDATE 트리거. status 변경 시 판매자 본인 또는 GUC 플래그 없으면 거부.
- `set_sold_at()` — 판매완료 시각 트리거(INSERT/UPDATE). legacy 판매완료 INSERT는 donated_at도 자동 설정.
- `get_or_create_conversation(p_product_id)` — 구매자가 대화방 생성/조회.
- `on_message_insert()` — 메시지 삽입 시 대화방 요약·읽음 갱신 트리거.
- `report_conversation(p_conv_id, p_reason)` — 참여자가 대화 신고(reported=true) + 관리자 알림.
- `admin_resolve_chat(p_conv_id)` — 관리자가 신고 해제. (RLS UPDATE+RETURNING 충돌 회피용 전용 함수)
- `admin_list_members()` — 관리자용 전체 성도 목록(실명·이메일·approved·`joined_via`·`avatar_url` 포함, 미승인 먼저 정렬).
- `admin_list_reported_chats()` — 관리자용 신고된 대화 목록.
- `cleanup_old_chats()` — 판매완료 7일 후 대화 삭제 **+ 30일 지난 notifications 삭제**. **pg_cron으로 매일 04:00 실행** (`cron.schedule`).
- `notify_*_webhook()` — products/reports/posts/messages 삽입 시 해당 Edge Function 호출(pg_net, `x-notify-secret` 헤더).
- `notify_profiles_webhook()` — 가입 승인 대기/승인 완료 알림용. 트리거 3종: INSERT(full_name 있을 때=이메일 가입) / full_name null→값 UPDATE(=OAuth 프로필 완성) → 관리자 승인 대기 알림, approved false→true UPDATE → 승인 완료 알림. (이메일·OAuth 각각 1회, 중복 없음)

> **RLS 요약(보안 개편 후)**: 읽기는 **로그인 우선** — products/posts/comments select = `auth.uid() is not null`(site_settings/categories만 공개). 쓰기(products·posts·comments·messages·favorites·reports·subscriptions insert, products update)는 **승인 필요** — `is_approved()` 조건 추가. 단 **본인 profiles UPDATE(알림 설정)는 승인 전에도 허용**. reserve/cancel/get_or_create_conversation/report_conversation RPC도 내부에서 `is_approved()` 검증.

### Storage
- 버킷 `product-images` (public). 업로드 경로 `${user.id}/파일명`. 정책: insert(authenticated), select(모두), update·delete(본인 owner_id 또는 admin).
- **프로필 사진**: `${user.id}/avatar.jpg` (덮어쓰기 upsert). upsert는 존재 확인용 SELECT 정책 필요 → `product_images_select` 추가함. avatar_url엔 `?v=timestamp` 캐시버스팅.

---

## Edge Functions (`supabase/functions/`)

전부 `npm:@supabase/supabase-js@2` import, `verify_jwt: false`(자체 인증 처리).

- **notify** — products/reports/posts/profiles 웹훅 수신.
  - A) 새 물품 → 구독자 이메일  B) 예약(판매중→예약중) → 판매자
  - C) 신고 접수 → 관리자 전체  D) 공지(notify=true) → 수신동의 성도 전체
  - E) 새 가입(INSERT, 이메일 가입) / 프로필 완성(full_name null→값, OAuth) → 관리자 전체("가입 승인 대기: 실명/닉네임")
  - F) 승인 완료(approved false→true) → 해당 성도("승인 완료, 이제 이용 가능")
  - `NOTIFY_SECRET` 헤더 검증. Brevo로 발송.
- **notify-chat** — messages/채팅신고 웹훅 수신.
  - 새 메시지 → 상대방에게 알림(단, **상대가 직전에 이미 읽은 상태였을 때만 1통**. 안 읽은 게 쌓여있으면 재발송 안 함)
  - **수신자가 최근 3분 이내 접속 중(`last_seen_at`)이면 이메일 스킵**(`skipped: recipient online`) — 인앱 알림·소리로 충분. online 체크가 email 체크보다 앞.
  - 대화 신고 → 관리자 전체.
- **invite-signup** — 주보 QR 초대 가입(verify_jwt false, CORS). 입력 email/password/full_name/nickname/code. 검증: invite_enabled='true' && code 일치(불일치 403·사유 비노출) → banned 사전 체크(한국어) → `admin.createUser(email_confirm:true, metadata)` → profiles `approved=true, joined_via='invite'`. 중복 409, 짧은 비번 400. 성공 시 프런트가 signInWithPassword로 즉시 로그인.
- **delete-account** — 본인 탈퇴. JWT 검증 후: 예약 해제 → 판매완료 익명화(seller_id=null, images=[]) → 나머지 물품 삭제 → **대화 삭제** → 스토리지 폴더 삭제 → 계정 삭제. CORS 포함.
- **admin-remove-user** — 관리자 강제 탈퇴. 호출자 관리자 확인 → 관리자/본인 대상 거부 → (ban=true면 banned_emails 추가) → 대상 콘텐츠 정리(delete-account와 동일) → 계정 삭제.

---

## 프런트엔드 (`index.html`) 주요 구조

**뷰 전환**: 상단 탭으로 `🥕 장터` / `💬 게시판` 전환(`switchView`). 관리자는 별도 모달(개편 예정 — 아래 로드맵).

**주요 화면/기능**
- 헤더: 로고(당근+십자가 SVG), 물품 올리기(좁은 폭 ＋아이콘), 🔔 알림(빨간점·흔들림), 💬 채팅(안읽음 배지), 프로필 드롭다운.
- 장터: 통계 배너 + 검색(placeholder "검색") + 카테고리 칩 + 정렬줄(최신/기부금순 + ↻새로고침 pill `.sort-refresh`). ↻는 검색창 밖·정렬 셀렉트 옆(모바일 잘림 방지).
- 물품 상세 모달: 이미지, 예약/취소, 판매자에게 문의(채팅), 찜, 공유, 신고, 나눔후기(구매자·7일).
  - **이미지 전체화면 라이트박스**(`#lightbox`): 이미지 탭 시 검은 배경·원본비율(contain). 여러 장이면 좌우 화살표+하단 "n/N" 카운터+스와이프(scroll-snap). 닫기: ✕/배경탭/뒤로가기(`history.pushState`+`popstate`). 핀치줌 허용(`touch-action`). `openLightbox/lbSlide/closeLightbox/updateLbCounter`.
- 프로필 모달(드롭다운 "👤 프로필"): 상단 아바타(탭→사진 변경)·닉네임(✏️)·가입일, 나눔 요약(나눔·받은 나눔·후기, **금액 없음**), 🏅 배지 진열장(달성=컬러/미달성=흐림+툴팁, 달성 배지 클릭→대표 지정), 이어서 내 물품/예약한 물품/🧡 찜 탭.
- 아바타: `avatarHtml(user,size)` 공용 헬퍼(사진 있으면 이미지, 로드 실패 시 이니셜 복귀). 표시 6곳 — 헤더칩·상세 판매자·게시글/댓글 작성자·채팅목록/방 상대·관리자 목록. 대표 배지는 상세 판매자·게시글 작성자 이름 옆.
- 게시판: 공지 배너 + 카테고리 필터 + 글쓰기(사진 5장) + 글 상세(댓글).
- 채팅: 목록 모달 / 채팅방 모달(Realtime, 신고 버튼, 비공개 안내) / 관리자 열람 모드.
- 알림 설정 모달: 가입 직후 **필수 온보딩**(공지 이메일 + 카테고리별 물품 알림).
- 관리자 모달: 통계 / 신고 물품 / 신고 채팅 / 성도 관리(강제탈퇴·차단 + 🎟️ 주보 초대 링크 블록: 켜기·복사·새 코드 교체) / 문구 / 카테고리.
- PWA: manifest + 아이콘. **서비스워커는 의도적으로 미사용**(stale 캐시 방지).

**아이콘/브랜딩**: 당근+십자가 SVG. 팔레트 — 몸통 `#E8641B`, 결 `#C24E12`, 잎 `#3E7C4F`/`#4C9260`,
십자가 `#FDFBF6`, 배경 `#FBF1E4`. SVG 좌표는 index.html의 PLACEHOLDER 상수와 favicon.svg에 있음.

**배포 파일**(저장소 루트): `index.html`, `favicon.svg`, `manifest.webmanifest`, `icon-192.png`, `icon-512.png`, `apple-touch-icon.png`, `og-image.png`(1200×630 링크 미리보기 카드), `_redirects`(netlify.app→apex 301), `_headers`(보안 헤더), `privacy.html`(GDPR 개인정보 처리방침, 로그인 없이 접근·랜딩/푸터/가입폼에서 링크).

> **개인정보 동의**: `privacy.html`(한국어 본문+이탈리아어 요약, 사이트 톤). **가입 동의 체크박스 3경로 모두 필수** — 이메일·QR초대는 회원가입 폼 `#suConsent`(doSignup에서 검증, invite 분기보다 먼저), 구글 OAuth는 프로필 완성 모달 `#pcConsent`(saveProfileComplete에서 검증). 처리 책임자·수집항목·목적·법적근거·보관/삭제·제3자(Supabase/Netlify/Brevo/Cloudflare)·이용자 권리·쿠키 미사용 명시.

> **보안 헤더**(`_headers`, `/*`): CSP + X-Frame-Options DENY + X-Content-Type-Options nosniff + Referrer-Policy strict-origin-when-cross-origin + Permissions-Policy(camera/mic/geo/payment 전부 차단). **CSP 화이트리스트**(수정 시 실사이트 CSP violation 재검증 필수): script/style `'unsafe-inline'`(단일파일 인라인 앱), Supabase(`connect-src` https+**wss**, `img-src` https), 구글 GIS `accounts.google.com`(script/style/connect/frame), 폰트 `cdn.jsdelivr.net`(Pretendard)·`fonts.googleapis.com`+`fonts.gstatic.com`(Caveat), `img-src data: blob:`(크롭·PLACEHOLDER). 새 외부 출처 추가 시 반드시 해당 지시어에 등록.

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
- 5차: **보안 개편** — 가입 승인제(`approved`·실명 `full_name`·`admin_approve_member`), 로그인 우선 랜딩(비로그인 랜딩·읽기 RLS `auth.uid() is not null`), 쓰기 RLS·RPC에 `is_approved()`, 승인 대기 화면, 관리자 승인 UI(대기 강조·승인 버튼), 가입 대기·승인 완료 이메일(notify E/F), "로그인 상태 유지" 세션 옵션(sessionStorage 어댑터), 딥링크 로그인 후 이어열기, 이메일 인증 안내·재발송. Supabase 인증 메일 한국어 템플릿(`docs/email-templates/`). 모금 목표 게이지(`goal_enabled/goal_amount`).
- 7차: **인앱 알림 센터**(🔔) — `notifications` 테이블·정의자 트리거(예약·취소·판매완료·댓글·후기·신고·가입대기), 헤더 종+빨간점(`notif_seen_at`)+딸랑 흔들림(reduced-motion 대응), 알림 패널(미읽음 음영·상대시간·클릭 시 대상 열기·모두 읽음), Realtime 구독(INSERT), 30일 후 자동삭제. RLS 본인만, 클라이언트 insert 불가.
- 8차: **실사용 긴급 수정 묶음** — 구글 로그인 GIS(`signInWithIdToken`+nonce, 카톡 등 실패 시 리다이렉트 폴백). [A]기부완료 단계(`donated_at`·`admin_set_donated`·판매내역 기부 토글·CSV 기부여부), [B]셀프예약 차단, [C]status 변경 판매자 전용(`enforce_status_change`+GUC, 관리자 `admin_set_status` 정정), [D]모바일 헤더(물품버튼 라벨·아이콘 44px·게시판 📋), [E]모바일 상세 스크롤(`overflow:hidden`→auto), [F]카카오톡 인앱(외부브라우저 배너·구글 안내·이미지 압축 폴백·IME `isComposing` 중복전송 가드).
- 6차: **구글 로그인**(OAuth) — 인증 모달에 "구글로 계속하기"(+"또는 이메일로" 구분선), `signInWithOAuth({provider:'google', redirectTo:location.origin})`. OAuth 사용자는 실명이 없어 **프로필 완성 모달**(필수·닫기 불가, 승인 대기·온보딩보다 먼저)로 실명·닉네임 입력 → `complete_profile` RPC. `handle_new_user`가 provider별로 full_name 분기, `get_my_profile` RPC로 본인 full_name 판단, 승인 대기 알림 트리거를 INSERT(full_name 有)+full_name채움 UPDATE로 분기(이메일/OAuth 각 1회).
- 9차: **장터 UI 다듬기** — 상세 이미지 전체화면 라이트박스(`#lightbox`, 검은배경·원본비율·좌우화살표·"n/N"카운터·스와이프, ✕/배경/뒤로가기 닫기, 핀치줌), ↻새로고침을 검색창 밖→정렬 옆 pill(`.sort-refresh`)로 이동(모바일 360px 검색창 잘림 해결), 검색 placeholder 이모지 제거("검색")·내부 렌즈 아이콘 제거.
- 11차: **성도 프로필** — `profiles.avatar_url·badge`, 프로필 사진 업로드(256px 정사각 크롭·`avatar.jpg` upsert·캐시버스팅, `product_images_select`/`_update` 정책 추가), 아바타 표시 6곳(공용 `avatarHtml`, 이니셜 폴백), 프로필 화면(드롭다운 "👤 프로필": 아바타·닉네임·가입일·나눔 요약(금액 X)·배지 진열장), **기념 배지**(🌱첫나눔1·🥕나눔이웃5·🧺나눔일꾼15·💌마음전달 후기3·🏛️창립멤버 2026, 전부 횟수 기준), `member_stats()` RPC(횟수·가입연도만)로 대표배지 계산(자동 최고 or 본인 선택)해 상세 판매자·게시글 작성자 옆 표시.
- 13차: **알림 소리 + 접속 중 이메일 스킵** — (A) WebAudio 합성 2음 차임(파일 없음, 첫 제스처에서 AudioContext unlock): 채팅 상대 메시지·종 알림 도착 시 재생, **내 메시지엔 X**(채팅방 핸들러 `sender!=me`, 목록 핸들러 `isConvUnread`+열린방 제외). 알림설정 모달 "🔔 알림 소리" 토글(`hmc_sound` localStorage, 기본 on). `playChime/unlockAudio/toggleSound`. (B) `profiles.last_seen_at` + 하트비트(`touchLastSeen`, 로그인·visibilitychange·2분, 숨김 정지) → notify-chat이 3분 이내면 이메일 스킵. 기존 종 흔들림·빨간점·채팅 배지 Realtime 동작 확인(정상).
- 12차: **GDPR 개인정보 처리방침 + 눈높이 튜토리얼** — (A) `privacy.html`(정적, 로그인 불필요, 한국어+이탈리아어 요약), 랜딩/푸터/가입폼 링크, 가입 동의 체크박스 3경로 필수(이메일·QR=`#suConsent`, 구글=`#pcConsent`). (B) 코치마크 튜토리얼: 첫 방문(온보딩 직후·또는 기존 사용자 최초 1회) 안내 모달→`hmc_tour_seen` localStorage, 좌하단 "📖 사용법" 재실행 버튼(로그인+승인 시), 7단계(인사·＋올리기·검색/카테고리·물품카드·채팅·종·게시판) 스포트라이트+오렌지 크레용 타원(feTurbulence)+말풍선. 요소 없으면 자동 건너뜀·N 재계산, 모바일 말풍선 뷰포트 클램프, reduced-motion 시 회전/트랜지션 off. `TOUR_STEPS`/`startTour`/`tourShow`/`drawCrayon`/`positionBubble`.
- 10차: **주보 QR 초대 가입** — 어르신용 주보 QR(`?invite=CODE`)로 접속 시 이메일 인증·관리자 승인 없이 즉시 가입·이용. DB(`profiles.joined_via`, `site_settings.invite_code/invite_enabled`, `admin_rotate_invite`/`invite_status` RPC, `settings_select`에서 invite_code 숨김), Edge Function `invite-signup`(코드 검증·admin.createUser·approved+invite), 프런트(회원가입 폼 🎟️ 배지/만료 안내, invite-signup→즉시 로그인→온보딩 직행), 관리자 성도관리 🎟️ 초대 블록(켜기/끄기·링크 복사·새 코드 교체·목록 🎟️), 인쇄용 QR(`docs/invite-qr.png` 당근색, `docs/make-invite-qr.py`). **초대는 기본 OFF** — 관리자가 성도 관리에서 켜야 동작.

### 수동 확인 대기 (실기기 필요 — 코드는 배포 완료)
- **구글 GIS 로그인**: Client ID 반영·배포됨(2026-07-10). Google Cloud Console → 승인된 JavaScript 원본에 `https://hanmaeumcarote.com` 등록 필요. One Tap 실패 시 자동으로 리다이렉트 방식 폴백되므로 깨지진 않음.
- **카카오톡 인앱 브라우저**: 배너·외부 브라우저 열기 스킴(`kakaotalk://web/openExternal`) — 실제 카톡에서 확인 필요(UA 목킹으로 렌더만 검증됨).
- **iOS 사파리**: 물품 상세 모달 스크롤 — 실기기에서 부드러운지 확인.
- **Supabase 인증 메일 템플릿**(`docs/email-templates/` 3종): 대시보드 수동 붙여넣기 방식 — 적용했는지 확인.

### 알려진 한계 (의도적 결정)
- **가입 승인제로 1차 방어**: 아무나 가입해도 관리자 승인 전엔 읽기만 가능(쓰기·예약·채팅·게시 전부 RLS 차단). 승인 없이는 실질 이용 불가.
- 이메일 인증(Confirm email) **ON**(대시보드에서 켬). Auth Custom SMTP는 Brevo(smtp-relay.brevo.com, SMTP 키). 인증 메일 실패 시 가입이 500으로 떨어지므로 SMTP 상태 주의. 인증 한국어 템플릿은 `docs/email-templates/`. CAPTCHA 없음.
- **구글 로그인 사용자**: 이메일 인증 불필요(구글이 인증). 대신 실명이 없어 로그인 후 프로필 완성 모달 필수 → 그 뒤 관리자 승인 대기.
- 재가입 차단은 이메일 기준(다른 이메일로는 재가입 가능). 강제 탈퇴(=거절)+차단은 기존 흐름 재사용.
- Supabase Auth "유출된 비밀번호 방지"(HaveIBeenPwned) — 켜기 권장(요금제 제한 가능).

---

## 이메일 스팸 주의
도메인 연결 + **Brevo 도메인 인증(SPF/DKIM) 완료**로 발신 도메인이 `hanmaeumcarote.com`(`noreply@hanmaeumcarote.com`)이 되어 스팸 도달률이 개선됨.
다만 초기에는 여전히 스팸함에 들어갈 수 있으니, 필요 시 사용자에게 스팸함 확인·수신 등록을 권고.
