# docs — 운영 자료

## 🎟️ 주보 초대 QR (`invite-qr.png`)

주보에 인쇄해 어르신들이 스캔하면 이메일 인증·관리자 승인 없이 바로 가입·이용하는 QR입니다.

- 현재 QR: [`invite-qr.png`](invite-qr.png) (흰 배경 · 당근 오렌지 `#E8641B` · 1000px)
- **초대 켜기/끄기·코드 교체**는 앱에서: 관리자 → 성도 관리 → 🎟️ 주보 초대 링크
- **코드 교체 후 QR 재생성** (교체하면 기존 주보 QR은 동작하지 않음):
  ```
  python docs/make-invite-qr.py <새-초대코드>
  ```
  (관리자 화면의 링크 끝 `?invite=` 뒤 코드를 그대로 넣으면 됩니다.)

## ✉️ 인증 메일 템플릿 (`email-templates/`)

Supabase Auth 한국어 메일 템플릿. 자세한 내용은 [`email-templates/README.md`](email-templates/README.md) 참고.
