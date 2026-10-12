# Feedback 01 — đợt 3: shapes và kích thước

Ngày kiểm chứng: 2026-10-12–2026-10-13. Phạm vi được giao: FB017–FB023. Đợt 4 FB024–FB029 chưa được giao. Entry vẫn là root `index.html`, mã và tài nguyên trong `assets/`. Không thêm dependency, backend, upload, runtime CDN hoặc persistence mặc định.

## Contract và triển khai

- **FB017:** `card-atlas:appearance` thêm `shape` (rectangle, rounded, square, circle, ellipse, diamond, triangle, hexagon), `sizeMode` (manual/fit), font 12–72px. Shape vắng mặt giữ giao diện legacy; shape không hợp lệ bị validator/schema từ chối. Tam giác cơ bản là tam giác đều; elip bao gồm oval. Contract lưu trong plan/spec, schema tải xuống và `NodeAppearance` TypeScript.
- **FB018:** registry tập trung sinh outline, safe area, ratio, hit test và anchor. SVG và Cytoscape dùng cùng polygon normalized, không nhận CSS/path tùy ý từ JSON. Các hình cố định tỷ lệ nằm trong bounds cũ; resize/Fit chủ động tạo kích thước đúng tỷ lệ. Controls nằm ngoài vùng nội dung; radius lớn của rounded được tính vào safe area. Circle/ellipse/diamond/triangle/hexagon chỉ hiển thị title/cover; summary/tags vẫn giữ trong model và Detail.
- **FB019:** sidebar palette hỗ trợ click/Enter ở giữa viewport và native drag/drop tại vị trí graph. Ảnh chọn file raster hợp lệ trước khi tạo; không tạo node rỗng khi Cancel. Search/fulltext/list nằm trong drawer (Ctrl/Cmd+F, Escape đóng và trả focus); Guide, counts, trạng thái và recovery trong menu dự án.
- **FB020:** handle vuông dưới phải resize, handle tròn nối relation. Preview không mutate model; pointerup một command, Escape/blur/pointercancel/lost capture rollback. Sync hủy resize đang dở; guards khóa history/view trong transaction. Ratio theo trục đang sửa/trục drag chi phối; giới hạn 96×64 đến 1200×1000. Chỉ geometry active view thay đổi.
- **FB021:** Manual/Fit và font 12–72 dùng chung draft. Fit đo overview được render, không đo Markdown body. Target width rồi height trong bounds; ảnh thuần dùng khung 240×180 trước khi giữ ratio. Fit/font/geometry Apply nguyên khối; overflow báo lỗi và không commit. Edit tiếp trong mode Fit đo lại tại Apply. Theme/locale/render không tự resize hoặc auto-layout. Camera Fit vẫn chỉ đổi góc nhìn.

Code dùng chung: `graph/shape-registry`, `graph/fit-text`, `canvas/overview`, `canvas/shape-view`, `canvas/text-measure`, `canvas/resize-node`, `ui/shape-palette`, `detail/image-file`. Overview dùng cho Canvas/Format/measurement, image-file dùng cho upload/palette; không sao chép các workflow này. Renderer chỉ cập nhật aria/control translations khi locale đổi để giảm chi phí selection trên graph lớn.

Nguồn renderer chính thức: [Cytoscape node body](https://js.cytoscape.org/#style/node-body), polygon và shape-polygon-points normalized −1..1. Dùng phiên bản Cytoscape 3.34.3 hiện có, không thêm thư viện.

## Verification

Browser plugin not available; dùng repo Playwright trên Chrome, Edge, Firefox tại `http://127.0.0.1:4173`. Desktop 1440×900 và 1050×900; Gallery có kiểm tra tablet/mobile, editor vẫn có desktop notice.

| Check | Kết quả |
|---|---|
| `node --test tests/*-core.test.mjs tests/core.test.mjs` | 51/51 PASS |
| `node scripts/check.mjs` | Syntax, ESLint, architecture 40 modules PASS; không cycle/import ngược |
| `tsc --noEmit` và `tsc -p tsconfig.modules.json` | PASS, phạm vi checkJs hiện hữu |
| Prettier check trên entry/CSS/JS/scripts/tests | PASS |
| `node scripts/build.mjs` | Local vendor build PASS |
| Full browser matrix cuối | 231/231 PASS trên bản trước sửa wrap; recheck Fit6/6 PASS sau sửa |

Geometry prototype: core và browser kiểm tra SVG border/safe area/anchor, bounds ở zoom 10%/400%. Browser shapes kiểm tra cả 8 choices, shared SVG/Cytoscape/connector geometry, corner hit area, mixed image kinds, transparent/light/dark, vi/en, keyboard/drop, resize Undo/cancel/view isolation, font72/Fit/overflow và two-view JSON round-trip. Console và network/storage checks của flow mới sạch; không request ngoài, localStorage/IndexedDB không được tạo mặc định. Hồi quy gồm guards, draft/caret, deletion/connector history, Markdown/Mermaid security, document/node transfer, opt-in recovery, radial/collapse và Gallery/Detail/viewer.

Lượt full đầu 227/228: assertion so sánh string của number input trên Firefox lệch chữ số thập phân cuối, đã đổi sang so sánh numeric. SVG anchor assertion dùng tolerance 0.01px cho CSSOM serialization; SVG/Cytoscape polygon vẫn so sánh exact. Targeted font/shapes 15/15 và bundled geometry 3/3 PASS sau sửa; Lượt matrix cuối trước sửa wrap:231/231 PASS; CSS wrap bổ sung kiểm tra rendered title6/6 PASS ngày2026-10-13. Báo cáo đầu giữ tại `feedback-01-phase3-browser-first.json` để trace.

## Benchmark smoke FB023

Chạy riêng, không song song UI/CPU checks. Chrome 154.0.8037.98; Windows 10.0.26200; Intel i5-10300H; RAM32GiB; viewport1440×900. Dataset500nodes/2000relations, 2,539,445bytes, 4nodekinds, portrait/landscape embedded images, Markdown/Mermaid và 8 basic shapes.

Lệnh: `node scripts/benchmark-radial.mjs card feedback-01-phase3 --shapes` rồi tương tự `mind`.

| View | Import | Overview max/5 mẫu | Pan median/10s | Radial preview | Overlap |
|---|---:|---:|---:|---:|---:|
| Card | 915.6ms | 198.2ms | 59.88FPS | N/A | 0 |
| Mind | 1147.5ms | 131.1ms | 59.88FPS | 635.9ms | 0 |

Targets giữ nguyên: import≤3s, Overview≤200ms, pan≥45FPS, radial≤3s, không overlap. Cả hai reports PASS; Mind Apply614ms, có warning layoutSpread do sơ đồ lớn. Reports `feedback-01-phase3-benchmark-card.json` và `-mind.json`, kèm machine/dataset/samples. Card Overview gần ngưỡng200ms; smoke này không thay benchmark đầy đủ extended shapes/font lớn ở FB028.

## Visual evidence và giới hạn

Screenshots trong `planning/design/`: feedback-03-shape-prototype, basic-shape, palette, fit-dark, image-1440, image-1050, example-mind và phase3-benchmark-card/mind. Đã xem ảnh prototype/palette/font72/image1050: hierarchy rõ, controls ngoài hình, toolbar không overflow sau chuyển trạng thái vào menu, ảnh contain và transparent vẫn chọn được. Không tuyên bố pixel-identical.

Ví dụ local: `assets/data/basic-shapes-example.json`, 8 nodes/7 branches, có node ảnh và Root; tải qua Format Guide rồi Import Project. README/AGENTS/development/plan/spec/schema/types/AI Guide đồng bộ. JSON1.0, unknown extensions, attachments, session/history và recovery opt-in giữ chính sách hiện hành.

Manual nhỏ có thể truncate title theo overview policy; Fit lớn không tự chạy camera/layout. Star/heart/octagon/arrow/triangle variants, full extended-shape benchmark và mobile editor thuộc phạm vi sau. Chưa push/publish; yêu cầu mở đợt4/push đang chờ xác nhận do automatic approval review rejection.

## Sửa sau visual QA ngày2026-10-13

Ảnh QA cho thấy unbroken title ở font72 vẫn ellipsis dù Fit. Đã mở lại FB021; dùng overflow-wrap:anywhere và text-overflow:clip giống nhau cho measurement/Canvas. Thêm assertion client/scroll dimensions của titlecircle. Playwright `tests/shapes.spec.mjs --grep "bundled shapes|font72"`:6/6 PASS Chrome/Edge/Firefox, report feedback-01-phase3-fit-recheck.json. Lượt chạy đầu sau chuyển môi trường bị connection-refused vì devserver đã dừng; xác minh terminal và khởi động lại scripts/serve.mjs tại127.0.0.1:4173, rồi kiểm tra lại PASS; không ghi lỗi môi trường thành lỗi app.

All shape UI recheck after wrap fix: `node node_modules/@playwright/test/cli.js test tests/shapes.spec.mjs`, 18/18 PASS, Chrome/Edge/Firefox; planning/test-results.json records expected18/unexpected0/flaky0. Static check repeated: syntax/lint and architecture40modules PASS.
