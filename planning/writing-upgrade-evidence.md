# E006/E007 — Nâng cấp trải nghiệm viết tài liệu

Ngày: 2026-10-11. Entry http://127.0.0.1:4173/, Card Atlas.

## Phạm vi đã hoàn thành

- Giữ cursor, selection và scroll trong editor khi đổi theme/locale. Giữ caret khi chuyển qua preview rồi về source.
- Viết tập trung rộng, metadata thu gọn, nút về sơ đồ trên header; Apply/Cancel cố định khi cuộn nội dung dài.
- Preview bản nháp dùng cùng renderer Markdown/Mermaid/attachments an toàn và kiểm soát async; preview không Apply hay thay project/history. Mục lục H1–H3 khi có từ2 headings.
- Tìm toàn văn nội dung đã Apply, đoạn trích và highlight bằng text nodes, không dùng user HTML.
- Templates Guide/API/Note vi/en append ở cuối, không thay nội dung. Download Markdown có ảnh dataURI; giới hạn lặp expansion ảnh khoảng10MiB để tránh file quá lớn.
- Recovery mặc định tắt. Người dùng bật trong dialog có thông tin dữ liệu; IndexedDB giữ snapshot gần nhất project/viewport/selection/draft/draftOriginal, marker opt-in localStorage. Debounce500ms; cap20MiB; restore chủ động qua replacement/draft guards; tắt xóa DB/marker; lỗi lưu hiện rõ; Cancel cập nhật bản snapshot. Recovery không gồm undo/redo. JSON export toast nhắc kiểm tra Downloads, không tuyên bố đã lưu file thành công.
- README/AGENTS và plan đồng bộ policy opt-in thay policy cấm persistence tuyệt đối cũ. JSON1.0, giới hạn canonical và default storage-off giữ nguyên.

## Verification

- node scripts/build.mjs: pass, vendor local.
- node scripts/check.mjs: syntax/lint pass.
- node --test tests/core.test.mjs:22/22 pass.
- tsc --noEmit và prettier --check:pass.
- Playwright full:87/87 pass, 29 scenarios × Chrome/Edge/Firefox, không retry/flaky; planning/test-results.json. Browser plugin/skill không khả dụng; dùng Playwright fallback.
- QA desktop1440×900,1050×800 và mobile390×844 notice, page identity/meaningful screen/không error overlay/console errors và warnings rỗng; planning/writing-qa.json. Luồng thực tế: mở card → edit → viết tập trung → preview/TOC; Apply hiển thị khi nội dung dài.
- Browser tests: theme/locale giữ caret+scroll; preview/history; templates append; search snippet; MD có ảnh; opt-in trước lưu; reload restore draft; Cancel cập nhật; disable xóa DB; lỗi quota vẫn cho export.
- Setup test Firefox được sửa để chờ caret auto-scroll của browser trước đặt scroll; ứng dụng giữ đúng vị trí đã ổn định.
- Benchmark chạy riêng sau suite:500 cards/2.000 relations; import649ms, Overview max79.7ms, median pan59.9FPS. Cả3 target pass, planning/benchmark-results.json. Lượt đo đồng thời với suite trước đó pan30.1FPS, đã kiểm tra lại khi máy không chạy các browser tests đồng thời.

## Visual evidence và giới hạn

Đã đọc screenshot light/dark: writing-editor-light.png, writing-preview-light.png, writing-preview-dark.png, writing-preview-1050.png trong planning/design/. Vùng viết rộng, metadata và TOC rõ, Apply không bị Duplicate/Delete che; mobile vẫn là desktop notice.

Recovery là snapshot gần nhất trên máy và có thể mất nếu trình duyệt xóa dữ liệu hoặc đóng trong debounce; vẫn cần export JSON. MD dataURI/Mermaid phụ thuộc trình đọc. Search chưa tìm draft hoặc highlight trong bài, chưa fuzzy/không dấu. Chưa có xuất HTML/PDF, backlinks nội bộ chuyên biệt hay mobile editor; không tuyên bố audit đầy đủ WCAG/screen reader. Backlog khác không triển khai.
