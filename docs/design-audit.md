# 디자인 감사 (Design Audit) — 한마음 CAROTE

> design-taste-frontend 스킬 §11.B 기준. **Phase 0 산출물** — 이 문서 승인 후 Phase 1로 진행.
> 우리는 빌드 없는 단일파일 바닐라이므로 스킬의 스택 처방(React/Tailwind/npm)은 배제하고 **원칙만** 적용.

## Design Read (§0.B)
*"밀라노 한마음교회 성도(어르신 포함) 커뮤니티 나눔 장터의 리디자인. 신뢰·따뜻함 우선 언어,
브랜드(당근+십자가·버터/오렌지·따뜻한 한국어)는 유지하고 실행 품질만 전문 웹 수준으로 끌어올리는 방향."*

- **모드**: Redesign — **Preserve** (§11.A). 브랜드·IA·카피 보존, 점진적 현대화.
- **다이얼**: `VARIANCE 4 / MOTION 3 / DENSITY 4` (trust-first 커뮤니티, §1.A).
- **§11.F 락 (승인 없이 절대 불변)**: 로고/워드마크(당근+십자가·"한마음 CAROTE"), URL·라우트(`?id/post/chat/invite`),
  폼 필드 구조·순서·name, 개인정보 동의 문구, IA(장터/게시판 탭·관리자 섹션 구성). **크레용 튜토리얼 손그림 스타일도 의도된 디자인 → 유지.**

---

## 1. 현재 브랜드 토큰 (보존 대상)
| 토큰 | 값 | 판단 |
|---|---|---|
| `--carrot` | `#E8641B` | 유지(브랜드 액센트, 단일) |
| `--carrot-deep` | `#C94F10` | 유지 |
| `--leaf` | `#3E7C4F` | 유지(보조: 성공/튜토버튼) |
| `--butter` | `#FBF1E4` | 유지(배경) |
| `--paper`/`--card` | `#FDFBF6`/`#FFFFFF` | 유지 |
| `--ink`/`--muted` | `#26201A`/`#8A7F70` | 유지(단, 뮤트 대비 점검 필요) |
| `--line` | `#EDE5D8` | 유지 |
| 본문 서체 | Pretendard (jsdelivr **CDN**) | **Phase 1: self-host** (CDN 차단 전례) |
| 손글씨 | Caveat (구글폰트 **CDN**) | **Phase 1: self-host** |
| 액센트 컬러 | 오렌지 1종 | ✅ Color Consistency Lock 이미 양호 |

→ **팔레트는 건강함(단일 액센트).** 문제는 색이 아니라 **토큰 체계·일관성·이모지 chrome**.

---

## 2. AI-slop / 실행품질 징후 (개선 대상)

### 2.1 Radius 카오스 — **12종+**
`6, 8, 10, 12, 13, 14, 16, 18, 20, 22, 24, 26, 999px` 혼재. 3단계 체계 없음.
→ **처방(§4.4 Shape Lock)**: `--r-sm 10 / --r-md 16 / --r-pill 999` 3단계로 통일, 나머지 토큰 치환.

### 2.2 타입 스케일 부재 — **~28종**
`8 · 9.5 · 10 · 10.5 · 11 · 11.5 · 12 · 12.5 · 13 · 13.5 · 14 · 14.5 · 15 · 16 · 17 · 18 · 19 · 20 · 21 · 22 · 23 · 26 · 27 · 36 · 40 · 44 · 52 · 60px`.
→ **처방**: 제목/본문/캡션 단계화한 스케일 토큰(예 `--fs-caption 12.5 / --fs-body 14.5 / --fs-strong 16 / --fs-h3 18 / --fs-h2 22 / --fs-h1 27 / --fs-display 40`).
**어르신 배려 — 본문 최소 크기 현행 이상 유지(절대 축소 금지).** 가격은 `tabular-nums` 유지.

### 2.3 Shadow 임의값
토큰은 `--shadow-card` 1개뿐, 나머지는 bespoke `box-shadow:0 …` 다수.
→ **처방**: `--sh-1`(작은 elevation) `--sh-2`(카드) `--sh-3`(모달/플로팅) 3단계, 배경 hue 틴트(순검정 금지, §4.4).

### 2.4 간격 임의값 — 고유 padding **80종**
`9px · 11px · 13px · 2px 7px` 등 4/8 그리드 밖 값 산재.
→ **처방**: `--sp-1..8`(4/8 기반) 스케일 도입, 주요 컴포넌트 간격을 토큰으로 치환.

### 2.5 이모지 chrome
UI 조작부(아이콘 자리)에 이모지 사용 — 플랫폼별 렌더 편차·정렬 흔들림·비전문적. **아래 3절에서 교체/유지 구분.**

---

## 3. 이모지 전수 인벤토리 (63종 · 243회)

### 3.A 교체 대상 — UI chrome → Phosphor Icons(regular, MIT) 스프라이트
| 이모지 | 용도 | Phosphor 후보 |
|---|---|---|
| 🔔 | 알림 종 | `bell` |
| 💬 | 채팅 | `chat-circle` |
| ✕ | 닫기 | `x` |
| ↻ 🔄 | 새로고침/코드교체 | `arrow-clockwise` |
| 🤍 🧡 | 찜(빈/참) | `heart` / `heart-fill` |
| 📢 | 공지 | `megaphone` |
| 🚨 | 신고 | `warning` / `flag` |
| 🔒 👁 🙈 | 비번 잠금·표시토글 | `lock` · `eye` · `eye-slash` |
| ✏ | 편집(닉네임 등) | `pencil-simple` |
| 📷 | 사진 변경 | `camera` |
| 📥 | CSV 내보내기 | `download-simple` |
| 🔗 | 공유 | `share-network` |
| ✉ 📧 | 이메일 | `envelope-simple` |
| 💰 | 기부 토글 | `hand-coins` |
| 👤 | 프로필 | `user` |
| 🗝 | 관리자 | `key` |
| 🔧 | (설정류) | `wrench` |
| ← ↑ → ➤ ❮ ❯ ↔ | 화살표/캐러셀/뒤로/맨위 | `caret-*` · `arrow-*` |
| 검색(placeholder) | 검색 | `magnifying-glass` |
| 📊 👥 🏷 🧾 ✍ 🎯 📖(사용법) | 관리자 사이드바·뷰탭·섹션 | `chart-bar`·`users`·`tag`·`receipt`·`note-pencil`·`target`·`book-open` |
| ✓ | 완료 표시 | `check` |

> 뷰 탭(🥕 장터 / 📋 게시판)·헤더 "＋ 물품 올리기"의 조작 아이콘도 이 계열로 통일.

### 3.B 유지 대상 — 의도된 따뜻함(교체 금지)
| 이모지 | 이유 |
|---|---|
| 카테고리 이모지(💚 무료나눔, 의류/가전/식품 등) | **DB `categories.emoji` 구동** — 성도가 관리, 정체성 |
| 기념 배지 🌱 🥕 🧺 💌 🏛 | 배지 시스템의 캐릭터(§11.F 의도) |
| 크레용 튜토리얼(SVG 손그림) | 의도된 손맛 — 유지 |
| 토스트의 가벼운 이모지(🥕 🎉 🙏) | 순간 피드백의 따뜻함 |
| 🎟 주보 초대 배지(가입 폼) | 어르신 대상 "표" 은유의 친근함 — **단, 관리자 목록/블록의 🎟는 조작부라 교체 검토** |
| 정렬 셀렉트 옵션(✨ 최신 · 💶 · 💎) | `<select>` 내부라 SVG 불가 — 텍스트 정리만(경미) |

> 이 구분은 Phase 2 착수 시 코드에 주석으로 명시.

---

## 4. 개선 계획 (단계별 · 각 단계 로컬 커밋 + 데스크톱/360px 스크린샷 승인)

- **Phase 1 — 타이포 + 토큰**: Pretendard/Caveat **self-host**(woff2 서브셋, `font-display:swap`, CDN 금지),
  타입 스케일·spacing(4/8)·radius 3단·shadow 3단 토큰화 후 임의값 치환. 본문 최소크기 현행↑, 가격 `tabular-nums`.
- **Phase 2 — 아이콘 시스템**: Phosphor 필요한 글리프만 `<symbol>` 스프라이트 내장 + `<svg><use>` 헬퍼(stroke/weight 통일).
  §3.A 전 항목 교체, §3.B 유지. **아이콘 품질: viewBox 2px 안전여백·`overflow:visible`·컨테이너 `display:grid;place-items:center`·`flex:none`·44px 터치.**
- **Phase 3 — 컴포넌트 폴리시**: 버튼 위계(primary/soft/ghost/danger)·입력/포커스링·카드/모달/토스트 radius·shadow 토큰 적용,
  빈 상태 정돈, hover/press 피드백(MOTION 3), WCAG AA 대비 점검(버터 위 오렌지/뮤트), `prefers-reduced-motion` 유지.
- **Phase 4 — 이메일 리디자인**: SVG 불가 전제 → 타이포+색+여백 중심 테이블 레이아웃(인라인 스타일, ≤480px 카드, 오렌지 헤더 라인)으로
  notify·notify-chat 전 메일 통일 재작성(MCP 바로 배포). 인증 메일 3종+승인 환영 메일도 동일 시스템(대시보드용, README 갱신). 제목당 이모지 ≤1.
- **마무리**: §14 프리플라이트 축약(대비/radius 일관/버튼 랩/테마 락/이모지 chrome 제거 등 해당 항목) + 전 화면 회귀(360/390/768/1280 + DPR2).

---

## 5. 리스크 / 주의
- **CDN 차단 전례**: 폰트는 반드시 self-host. 외부 링크 금지.
- **CSP(`_headers`)**: self-host 폰트는 `'self'`라 오히려 CSP 단순화. 아이콘 스프라이트는 인라인 SVG라 CSP 무관.
- **어르신 가독성**: 대비·본문 크기 절대 후퇴 금지가 최우선 제약(미적 선호보다 우선, §0.A).
- 각 Phase는 **push 없이 로컬 커밋만**, 스크린샷으로 승인 후 다음 단계.
