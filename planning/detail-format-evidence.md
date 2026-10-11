# E008 — Detail Format và chỉnh hình dạng Card

Ngày2026-10-11. Entry http://127.0.0.1:4173/, Card Atlas.

Tab Format: width/height, background/text/border colors, corner radius0–100px, borderWidth0–8px, titleFontSize12–24px, align left/center/right, shadow none/soft; rectangle/rounded presets; reset appearance. Preview thể hiện draft. Edit/Format chia sẻ draft không cần guard ở giữa; rời Overview/card vẫn guard. Apply atomic, Cancel và undo/redo hoạt động; size và namespace card-atlas:appearance giữ khi export/import JSON1.0. Default khi namespace thiếu:radius10,border1,title14.5,left,soft. Namespace validator từ chối kiểu sai, out of range và unknown keys.

Toolbar Markdown chọn text → bold/italic/inlineCode/color. Color syntax [text]{color:#RRGGBB}; Marked inline tokenizer đăng ký một lần theo [official extension docs](https://marked.js.org/using_pro#extensions). Text trong token escape; output sanitize rồi chỉ set color sau regexhex6. HTML/CSS tùy ý không được cho phép. HTML attack và màu CSS sai đã kiểm tra không tạo img/script. Preview và Overview dùng cùng renderer.

## Checks và bằng chứng

- Syntax/lint và Prettier pass, TypeScript contract check pass. Core23/23 pass.
- Full Playwright93/93 pass (31scenarios × Chrome/Edge/Firefox), planning/format-full-results.json; sau chỉnh class tags trong preview để pill giống Canvas, targeted6/6 pass tại planning/test-results.json. Không retry/flaky.
- Test mới: Edit → Format giữ title draft; live preview không thay Canvas; Apply resize/radius/font một transaction; undo/redo; export portable; Cancel; vi/en; dark; selection toolbar; hex color; rawHTML/CSS unsafe blocked. Core kiểm tra appearance limits + roundtrip +history.
- QA trực tiếp1440×900,1050×800,390×844 mobile notice; page identity/notblank/không overlay, console errors/warnings rỗng trong planning/format-qa.json. Browser plugin/skill không khả dụng, dùng Playwright fallback.
- Visual đã đọc screenshots detail-format-light.png, detail-format-preview.png và detail-text-color.png tại planning/design; detail-format-dark.png có evidence dark/en. Preview tag đã đổi sang đúng card-badge/tag-badge và meta layout.

## Giới hạn rõ ràng

Resize hiện dùng numeric controls trong Format; chưa kéo góc trực tiếp trên Canvas. Card vẫn là rectangle/rounded rectangle, không thêm ellipse/diamond. Dark theme tiếp tục điều chỉnh màu card để giữ readability; Light hiển thị màu đã chọn trực tiếp. Size quá nhỏ có thể không đủ overview. Cú pháp màu là Card Atlas extension, không đảm bảo trình đọc Markdown bên ngoài hiểu; màu áp dụng text một dòng, có thể bọc Markdown đậm/nghiêng phía ngoài. Không đổi JSON version, không backend/upload. README và plan/spec đồng bộ.
