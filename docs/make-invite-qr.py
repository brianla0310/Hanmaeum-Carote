#!/usr/bin/env python
# 주보 인쇄용 초대 QR 생성기
#   사용법: python docs/make-invite-qr.py <초대코드>
#   예)    python docs/make-invite-qr.py H2K6MUFUYVWQ
#   - 관리자 화면(성도 관리 → 주보 초대 링크)에서 '새 코드로 교체'를 누르면
#     코드가 바뀌므로, 새 코드로 이 스크립트를 다시 실행해 QR을 갱신하세요.
#   - 결과: docs/invite-qr.png (흰 배경 · 당근 오렌지 모듈 · 1000px)
import sys
import qrcode
from qrcode.constants import ERROR_CORRECT_H
from PIL import Image

BASE = "https://hanmaeumcarote.com/?invite="
CARROT = (232, 100, 27)   # #E8641B
WHITE = (255, 255, 255)
SIZE = 1000

code = (sys.argv[1] if len(sys.argv) > 1 else "").strip()
if not code:
    print("사용법: python docs/make-invite-qr.py <초대코드>")
    sys.exit(1)

url = BASE + code
qr = qrcode.QRCode(
    version=None,
    error_correction=ERROR_CORRECT_H,   # 인쇄·훼손 대비 30% 복원
    box_size=10,
    border=4,                            # 넉넉한 여백(quiet zone)
)
qr.add_data(url)
qr.make(fit=True)
img = qr.make_image(fill_color=CARROT, back_color=WHITE).convert("RGB")
img = img.resize((SIZE, SIZE), Image.NEAREST)
out = "docs/invite-qr.png"
img.save(out)
print(f"OK  {url}  ->  {out}  ({img.size[0]}x{img.size[1]})")
