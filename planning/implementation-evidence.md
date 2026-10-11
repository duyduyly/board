# Bằng chứng triển khai V1

## T001 — Quyết định contract (2026-10-11)

- Position/size/canvas.position: object nếu có phải đủ thành phần; thiếu cả object được default. Style từng trường optional, bổ sung defaults.
- History budget tính byte UTF-8 JSON của forward/inverse patch, không tính overhead JS objects. Undo không sao chép toàn project cho mỗi thao tác.
- Export Current xử lý draft trước; lỗi export giữ project cũ. snapshot ghi nhận download initiated, không xác nhận lưu đĩa.
- Vi/en chỉ session; UI strings không sửa project. References/status giữ V1.1.
- Kiến trúc static root index.html và assets/js; thư viện graph Cytoscape + native DOM overlay cho card typography và connector, không tự viết raw canvas engine.
- Primary docs: https://js.cytoscape.org/ ; https://mermaid.js.org/config/usage.html ; https://marked.js.org/ ; https://ajv.js.org/guide/getting-started.html

Kiểm chứng T001: đối chiếu plan và các mục 7/8/10/15/17 của spec, các lựa chọn không thay scope.

## Nền tảng T002–T012, T045

- Stack: vanilla ES modules, root index.html; Cytoscape + HTML card overlay; Ajv JSON Schema; Marked + DOMPurify; Mermaid lazy local bundles. Exact versions in package.json/package-lock.json.
- Prototype: Chrome 9-scenario suite demonstrated custom cards, edges, connector-drop, drag/zoom and adapter isolation. Design reference and browser screenshot under planning/design/.
- Build: node scripts/build.mjs succeeded. Lint/syntax: node scripts/check.mjs succeeded. Contract type check: node node_modules/typescript/bin/tsc --noEmit succeeded. TypeScript checks contract declarations; runtime JS uses lint, schema tests and browser tests.
- Core: node --test tests/core.test.mjs — 15/15 pass. Covers schema parity, finite values, strict fields, mixed grid, limits, IDs, cycles/parallel, cascade ordered restoration, atomic connector, history limits, snapshots, extensions, search and vi/en key parity.
- Browser matrix first pass: 27/27 (9 scenarios × Chrome/Edge/Firefox). A larger suite is being run for endpoints/style, external image opt-in and normalization/leave guards.

### Giữ project có thể import lại

Validator kiểm tra cả kích thước JSON export chuẩn hóa ≤10 MiB, không chỉ input file. Stage kiểm tra lại sau normalization; commands từ chối trạng thái vượt giới hạn. Đây là bổ sung T001 cho tính nhất quán import/export; mục 8 của spec đã đồng bộ.

## Kiểm chứng hoàn tất — 2026-10-11

Entry: index.html ở root. Source CSS/JS trong assets/. Dependencies được khóa bằng package-lock.json; build sinh vendor modules local, không CDN runtime. Không tạo backend lưu dữ liệu hoặc persistence.

### Môi trường và commands

- Node 25.8.2, Windows 10.0.26200, desktop 1440×900; màn hình nhỏ 390×844 hiển thị yêu cầu desktop.
- Chrome 154.0.8037.98, Edge 155.0.4283.45, Firefox 157.0 (Playwright Firefox build).
- IAB: “Browser is not available: iab”; đã dùng Playwright theo frontend testing workflow.
- node scripts/build.mjs: local vendor bundles thành công.
- node scripts/check.mjs: syntax/ESLint pass.
- node node_modules/typescript/bin/tsc --noEmit: contract declaration type check pass. Runtime JS không được tuyên bố là strict TypeScript; được kiểm tra bằng schema/lint/tests.
- node --test tests/core.test.mjs: 19/19 pass.
- node node_modules/@playwright/test/cli.js test: toàn bộ 16 scenario × 3 browser; xem e2e-full-results.json sau run cuối.
- Prettier check: pass; code nguồn đã được format.
- node scripts/qa-capture.mjs: page đúng URL/title, không blank, không overlay, console errors/warnings đều rỗng, screenshot desktop/editor/guard/mobile có nội dung thực.
- HTTP smoke sau restart server: / và /assets/js/app.js trả 200; /.git/config và /planning/implementation-plan.md trả 404. Dev server chỉ bind localhost và phục vụ index/assets.

### Trace theo checklist

| Task | Code/evidence | Kiểm chứng |
|---|---|---|
| T001 | Quyết định contract phía trên; spec mục 7/8/10/12/17 | Partial position, patch budget, draft/export guard, canonical-size consistency, Mermaid policy được ghi rõ |
| T002–T003 | package.json, package-lock.json, scripts/, index.html | Prototype custom cards/edges/connector/viewport, build/dev/lint/types và browser smoke |
| T004–T008 | assets/js/json/, assets/data/, tests/fixtures/, tests/core.test.mjs | Schema parity; errors paths; IDs/references/limits; deterministic grid/defaults; examples valid; extensions finite/encoding guard |
| T009–T012 | assets/js/store/project-store.js | Atomic patches; ordered cascade undo; redo invalidation; history eviction/oversize; dirty snapshot và viewport separation |
| T013–T019 | index.html, assets/js/canvas/adapter.js, assets/css/app.css | Card overview, adapter mapping, wheel/Space-pan, drag, selection, duplicate/delete, parallel/cycle, connector drop và Escape |
| T020–T023 | assets/js/app.js, assets/css/app.css | Panel resize bằng chuột/bàn phím; draft Apply/Cancel; endpoint/style editing; invalid Apply giữ draft; selection/replacement guards |
| T024–T027 | assets/js/detail/, app.js | Markdown sanitize; Mermaid text render/lazy/error/policy; opt-in external images reset theo phiên; incoming/outgoing navigation |
| T028–T035 | assets/js/json/, app.js, assets/data/ | Staged import preview; invalid import không mutate; draft export choices; simulated failed download giữ dirty; New/import cancel; beforeunload; schema/example/AI guide; round-trip |
| T036–T038 | app.js, assets/css/app.css | Search đúng fields; keyboard không xóa khi đang input; responsive desktop, empty/error/loading states, mobile notice |
| T039–T041 | tests/editor.spec.mjs, e2e-full-results.json, browser-qa.json | Browser matrix, payloads không thực thi, network/storage checks; Chrome/Edge/Firefox versions ghi lại |
| T042–T043 | scripts/benchmark.mjs, benchmark-results.json | Dataset tái tạo 500 cards/2.000 relations, card gần Markdown limit, có Mermaid mẫu; cache list/selection giảm render lại không cần thiết |
| T045–T047 | assets/js/i18n/, app.js | Dictionaries cùng key; interpolation/fallback; dev missing-key diagnostics; toolbar/dialog language switch giữ draft/content; vi/en flows và export equality |
| T044 | README.md, plan/checklist, tất cả evidence trên | Static entry/assets usable; release gates đối chiếu; không publish hosting; backlog giữ nguyên |

### Các luồng browser đã kiểm tra

Mở ví dụ → chọn card → đọc Mermaid → đổi vi/en → export và so sánh; sửa draft → đổi locale → guard Cancel → Apply → Undo; drag/duplicate/delete/undo; connector vào vùng trống → undo atomic; import syntax lỗi và import file export lại; export applied giữ draft và replacement Cancel; Markdown unsafe/URL/images/invalid Mermaid; search/keyboard/panel resize/mobile; Format Guide không clear dirty; Connect + relation endpoint/style/self-loop; external-image opt-in và reload reset; normalization dirty/beforeunload/view-only; luồng tiếng Anh; wheel/Space pan; export giả lập lỗi/Escape connector; Mermaid init/image resource bị chặn trước render.

### Privacy và giới hạn đã ghi nhận

- Không có localStorage/IndexedDB/project upload/analytics trong implementation. Tests quan sát network không có request ngoài khi mở nội dung chưa opt-in. Không tuyên bố đây là security audit độc lập.
- Mermaid source config/style/click/image/URL bị chặn trước render, vẫn giữ source để sửa; SVG output sanitize và không bind callback. Policy được mô tả trong spec/README.
- npm audit ghi nhận 2 cảnh báo low cùng một advisory KaTeX qua Mermaid (GHSA-238p-pmpm-9mq7), điều kiện liên quan prototype pollution có sẵn. Mermaid 12.1.0 yêu cầu KaTeX ^0.16.47; bản vá advisory ở nhánh khác. Không tự downgrade Mermaid hoặc override sang minor không tương thích. Chưa xác nhận độc lập toàn bộ chuỗi khai thác; đây là rủi ro dependency còn theo dõi, không coi audit là sạch.
- beforeunload phụ thuộc browser; export chỉ xác nhận initiated; dữ liệu mất khi đóng/reload đúng thiết kế. Mobile editing và hosting production chưa thuộc phần đã kiểm chứng.
- Benchmark là một máy, một dataset và warm loaded app; không suy ra hiệu năng trên mọi máy hay graph layout. Selection timing không gồm render Mermaid; import timing không gồm thời gian người dùng xem preview.

### Bằng chứng giao diện

Concept: planning/design/editor-concept.png (built-in Image Gen, full editor brief). Design tokens: planning/design/design-system.md. Browser: editor-browser.png, empty-browser.png, editor-form-browser.png, draft-guard-browser.png và mobile-browser.png trong cùng thư mục. Đã mở concept và browser screenshot bằng view_image để đối chiếu. Nội dung/màu card sử dụng fixture JSON nguồn; các controls/guard/locale bổ sung theo yêu cầu plan.

Các screenshot này được giữ để làm evidence của checklist, không dùng làm ảnh nền sản phẩm.

### Phiên bản dependency

- ajv: 8.20.0
- cytoscape: 3.34.3
- dompurify: 3.4.16
- marked: 18.1.0
- mermaid: 12.1.0

### Benchmark cuối

- Import: 602.8 ms (target ≤3000).
- Overview max: 53.9 ms (target ≤200).
- Pan median: 59.9 FPS trong 10.02 giây (target ≥45).
- Máy: Intel(R) Core(TM) i5-10300H CPU @ 2.50GHz, 32 GiB RAM. Các target đều pass.

## Bổ sung ví dụ và giao diện 1.0.0 — 2026-10-11

### E001 — Ví dụ tiếng Anh

- assets/data/english-endings-example.json: 11 card, 13 quan hệ; công thức, chính tả, phát âm -s/-es và -ed, lỗi thường gặp, 10 câu tự luyện, đáp án và nguồn Cambridge/British Council/BBC.
- Nút mở ví dụ riêng ở welcome, có nhãn vi/en; ví dụ kiến trúc cũ giữ nguyên.
- Browser kiểm tra mở project, Markdown/Mermaid, vi/en, export và reimport bằng deep equality trên cả ba trình duyệt.
- Lần test đầu có selector sai (#panel-content); đã sửa sang #panel-body và nhãn Áp dụng dữ liệu, không phải lỗi runtime ứng dụng.

### E002 — Badge, theme, Fit/Focus và README

- Card có type badge, tối đa hai tag riêng biệt, +N tooltip và số quan hệ; dùng textContent cho dữ liệu user. Panel loại bỏ type/tag trùng.
- Nút Sáng/Tối (Light/Dark), CSS tokens cho chrome, forms, dialog, canvas và card; edge label/selected edge và Mermaid đổi theo theme. Màu lưu trong project không đổi.
- Fit có label rõ ràng; Focus card căn giữa và zoom tới mức dễ đọc; Focus relation fit đường nối cùng hai endpoints. Không lọc dữ liệu hoặc đổi card positions. Disabled khi chưa có selection phù hợp.
- Theme chỉ memory phiên, reset Light khi reload. Browser xác nhận theme/locale/Fit/Focus không đổi model, undo/redo, dirty; draft sống qua theme và locale switch.
- Kiểm tra Focus relation sau mở rộng panel và Fit sau resize. Focus theo hướng/depth B103 vẫn backlog.
- README ghi 1.0.0, công nghệ/cấu trúc, tính năng, hướng dẫn ví dụ/chỉnh sửa/quan hệ/điều hướng/theme/import-export/chạy/deploy và giới hạn. JSON version vẫn 1.0.

### Lệnh và kết quả trên cùng bản code

- npm run build: PASS.
- npm test: 19/19 PASS.
- npm run check / typecheck / format:check: PASS.
- npm run e2e: 57/57 PASS (19 scenarios × Chrome/Edge/Firefox), 0 unexpected, 0 skipped, 0 flaky; planning/e2e-full-results.json.
- node scripts/qa-enhancements.mjs: PASS; đúng URL/title, meaningful content, không error overlay, console errors=[]/warnings=[]; Light/Dark, dark Mermaid và toolbar không clipping ở 1050px. Viewports 1440×900, 1050×800, 390×844 (mobile notice). Browser plugin/skill không khả dụng; dùng Playwright theo skill fallback. planning/enhancements-qa.json và planning/design/english-*.png là evidence.
- node scripts/benchmark.mjs: PASS với 500 cards/2.000 relations: import 626.2 ms; Overview max 106.4 ms; median pan 59.9 FPS. Máy/phương pháp trong planning/benchmark-results.json; không suy rộng ra mọi thiết bị.

User đã yêu cầu commit phần code sau khi hoàn tất. Giữ các giới hạn và cảnh báo dependency mức low đã ghi ở trên; chưa deploy hosting.
