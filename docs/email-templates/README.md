# 한마음 CAROTE · Supabase 인증 이메일 템플릿

Supabase Auth가 보내는 **인증 관련 이메일**의 한국어 HTML 템플릿입니다.
notify / notify-chat 엣지 함수(알림 메일)의 공통 셸(shell)과 **같은 디자인**으로 통일했습니다:
버터색 배경 · 480px 카드 · **상단 5px 오렌지 그라데이션 바** · 당근 오렌지 워드마크(이모지 없이 텍스트) ·
큰 제목 · 본문 `#57503F` · 중앙 정렬 오렌지 pill 버튼 · 회색 푸터.

> ⚠️ 이 파일들은 **대시보드에서 수동으로 붙여넣어** 적용합니다. 저장소에 있다고 자동 반영되지 않아요.
> 발송이 되려면 **Auth Custom SMTP(Brevo)** 가 정상 설정돼 있어야 합니다.

---

## 적용 방법 (Supabase 대시보드)

1. Supabase 프로젝트 → **Authentication → Emails → Templates** 로 이동
2. 아래 표의 **템플릿 탭**을 선택
3. **Subject heading**(제목) 칸에 아래 제목을 입력
4. 해당 `.html` 파일 내용을 **전부 복사**해서 **Message body (Source/HTML)** 칸에 붙여넣기
   - 편집기에 `</> Source` 또는 HTML 보기 토글이 있으면 켜고 붙여넣으세요.
5. **Save** 후, 실제로 한 번 테스트 발송(가입/재설정)해서 확인

| 파일 | 대시보드 템플릿 탭 | 제목(Subject) |
|---|---|---|
| [`confirm-signup.html`](confirm-signup.html) | **Confirm signup** | `🥕 [한마음 CAROTE] 이메일 인증을 완료해주세요` |
| [`reset-password.html`](reset-password.html) | **Reset Password** | `🔒 [한마음 CAROTE] 비밀번호 재설정` |
| [`change-email.html`](change-email.html) | **Change Email Address** | `✉️ [한마음 CAROTE] 이메일 변경 확인` |

---

## 템플릿 변수 (Supabase Go 문법)

각 파일 안에 이미 들어 있습니다. 그대로 두세요.

- `{{ .ConfirmationURL }}` — 인증/재설정/변경 확인 링크 (버튼과 하단 fallback 주소에 사용)
- `{{ .NewEmail }}` — 이메일 변경 템플릿에서 새 이메일 주소 표시용

> 링크 만료 시간·리다이렉트(Site URL)는 대시보드 설정을 따릅니다.
> Site URL 은 `https://hanmaeumcarote.com` 로 맞춰져 있어야 링크가 사이트로 돌아옵니다.

---

## 알림 함수 메일 (대시보드 아님)

[`approval-welcome.html`](approval-welcome.html) — **가입 승인 완료** 시 성도에게 보내는 환영 메일의
미리보기/보관용 사본입니다. 위 인증 템플릿과 달리 **대시보드에 붙여넣는 게 아니라**,
`notify` 엣지 함수(F 분기, `approved` false→true)가 이 HTML을 직접 발송합니다.
문구·디자인을 바꾸려면 이 파일과 함께 **엣지 함수 `notify`의 F 분기**를 수정하고 재배포해야 합니다.
(제목: `🎉 가입이 승인되었어요`)

---

## 디자인 값 (참고 · 엣지 함수 shell 과 동일)

- 최대폭 480px 중앙 카드, radius `16px` / 인라인 스타일만 사용(이메일 클라이언트 호환)
- 배경 `#FBF1E4`(버터) · 카드 `#FDFBF6` · 카드 테두리 `#EDE5D8`
- 상단 5px 오렌지 그라데이션 바(`linear-gradient(90deg,#F0902A,#E8641B,#C24E12)`)
- 워드마크 `한마음 CAROTE` 오렌지 `#E8641B` 800(이모지 없이 텍스트, 20px) · 제목 22px `#26201A` 800
- 본문 `#57503F` · 보조/푸터 `#8A7F70` · 강조 링크 `#B5460D`
- 버튼: 중앙 정렬 pill, 배경 `#E8641B` 흰 글씨, radius 999px, padding `14px 32px`
- 하단 안내: `밀라노 한마음교회 사랑나눔 바자회 · hanmaeumcarote.com`

문구·색을 바꾸려면 이 폴더의 파일을 수정하고 다시 대시보드에 붙여넣으면 됩니다.

---

## 참고 — 다루지 않은 템플릿

Supabase의 나머지 인증 템플릿(**Magic Link, Invite user, Reauthentication**)은
현재 앱에서 사용하지 않아 만들지 않았습니다. 필요해지면 위 3개와 같은 구조로 추가하세요.
