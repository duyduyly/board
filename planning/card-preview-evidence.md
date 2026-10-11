# E005 — Card overview và hover ảnh 100%

Ngày: 2026-10-11. Entry: http://127.0.0.1:4173/, Card Atlas.

Hoàn thành thiết kế trong [card-design.md](card-design.md), README cập nhật cách mở Overview và ảnh 100%. Card mới/default thiếu size 260 × 190 px, custom size giữ nguyên. Không đổi JSON version hay dữ liệu/history/dirty khi hover hoặc đổi theme.

Verification: node scripts/check.mjs pass; node --test tests/core.test.mjs 21/21 pass; tsc --noEmit pass; Prettier check pass; Playwright full matrix 75/75 pass (25 scenarios × Chrome/Edge/Firefox, không retry/flaky). Report: test-results.json. QA script qa-enhancements.mjs xác nhận desktop 1440 và 1050, mobile notice; console errors/warnings rỗng trong enhancements-qa.json. Browser plugin/IAB không khả dụng trong phiên, dùng Playwright fallback.

Ảnh nhúng 640 × 280 hiển thị preview đúng 640 × 280 CSS px; ảnh 1800 × 1200 giữ nguyên kích thước, khung có scroll ngang/dọc. Kiểm tra mở card không drag, title clamp 2 dòng, hover/focus, thoát chuột, Escape, đổi theme/selection, vi/en và project snapshot không đổi. Đã sửa lỗi Escape rerender Detail làm preview tự bật lại bằng bắt Escape ở capture phase khi preview đang mở.

Visual QA light/dark đã đọc ảnh và kiểm tra bố cục, badge/tags/handle, ảnh gốc không bị panel clip: [light](design/card-image-hover-light.png), [dark](design/card-image-hover-dark.png). Dark Canvas #2a342e, card #232d27 tint nhẹ. Graph Fit thu nhỏ toàn sơ đồ nên chữ card thu theo zoom; Focus dùng để đọc card ở tỷ lệ gần hơn.
