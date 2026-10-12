# E009 — Màu trong suốt

2026-10-12. DONE. Background/border transparent checkboxes vi/en trong Edit/Format; defaultfalse, giữ style hex. Namespace card-atlas:appearance.backgroundTransparent/borderTransparent boolean; validator từ chối kiểu sai. JSON1.0; preview/Apply/Cancel/Reset/undo/redo giữ atomic. CSS override cả dark tint và Mind Map branch border; transparent background không shadow, selection outline vẫn rõ. Không cho màu chữ transparent.

Browser plugin not available; dùng frontend-testing-debugging skill với repo Playwright. Flow localhost4173 → ví dụ → Format → checkbox → preview/Apply → theme/view → undo/redo → export/stage/reimport → Edit bỏ chọn → màu cũ. Chrome/Edge/Firefox,1440×900. Tests transparency.spec.mjs + editor.spec.mjs grep transparent|Format shares draft:9/9 PASS; report transparency-browser-results.json. Page identity/nonblank, runtime pageerrors0, dark/mind/light screenshots inspected. Không chạy lại full147 hoặc benchmark cho thay đổi cục bộ này; mobile chỉ có desktop notice như hiện tại.

node --test tests/*-core.test.mjs tests/core.test.mjs:34/34 PASS, gồm typed flags/roundtrip/color preservation/undo. Syntax/lint và tsc --noEmit PASS; Prettier check PASS. Ban đầu test dùng màu green thay vì purple của fixture và constructor store không replace; sửa test expectations/setup, sản phẩm không cần sửa cho hai lỗi test này.

Files: assets/js/detail/appearance.js, app.js, i18n vi/en, assets/css/app.css; tests/transparency*; README/plan/spec/checklist. Screenshots: planning/design/transparent-dark-mind.png, transparent-restored-light.png. Giữ thay đổi .gitignore của user, không đưa vào commit.
