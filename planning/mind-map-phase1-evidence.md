# Đợt 1 Illustrated Mind Map

2026-10-12. Đang triển khai.

## MM001 Contract

JSON1.0 giữ nguyên. node: kind required; coverImageId required cho image/image-text; imageFit contain/cover default contain; imageAlt string optional. views.mindMap: positions/sizes map ID có finite geometry, size>0; viewport zoom0.1–4/point. mind-map project rootId optional; relation kind branch/reference và color hex optional. Unknown owned keys reject, unknown namespaces preserve. Branch acyclic một parent; Root không parent. Root có parent cần explicit detach atomic. Viewport session và export overlay, không dirty/history. Fallback Mind Map dùng card.position và text260x80/image260x190; không mutate khi switch.

Renderer Cytoscape3.34.3 local, unbundled-bezier control-point-distances/weights; docs https://js.cytoscape.org/#style/unbundled-bezier-edges . Không dependency mới. Browser plugin not available; Playwright.

## MM003/MM004 checks

node --test tests/core.test.mjs tests/mind-map-core.test.mjs:27/27 pass. Geometry isolation, legacy import, branch invariants, cleanup undo, cover errors và serializer session overlay được kiểm tra. MM004 đang tích hợp browser.

## MM002 prototype

Playwright Chrome single edge: unbundled-bezier, controlPoints non-empty; fixed node width260, two text overlays. Screenshot planning/design/mind-map-prototype.png. Prototype pass1/1.

## Tích hợp MM005–MM010

Chrome tests/mind-map.spec.mjs kiểm tra cover picker, Apply/Cancel, cover-delete guard, 4 node styles, ảnh decode không request ngoài, click image mở Overview, vi/en/light/dark, switch giữ draft, resize hai view undo atomic, Root explicit detach, delete/duplicate, drag, Fit/Focus và opt-in recovery. Screenshot mind-map-dark.png / mind-map-light.png.

## Regression và corrections

Full suite node node_modules/@playwright/test/cli.js test:117/117 pass, Chrome/Edge/Firefox, 1440x900 và desktop1050/mobile390 được tests hiện có kiểm tra. Report planning/mind-map-phase1-full-results.json. Core28/28 pass; syntax/lint và typecheck pass. Browser absent; localhost http://127.0.0.1:4173. Không blank/error overlay; tests page identity, console, network, screenshots và interactions pass.

Một test recovery mới ban đầu dùng nhãn draft thay vì nhãn thật Unapplied changes; sửa assertion. Connector test ban đầu drop vào node có sẵn, sửa chọn vùng trống bằng hit-test; kết quả targeted3/3 trên ba browser. Regression embedded-image roundtrip trước đây so cả canvas sau sidebar Focus; chỉnh assertion giữ kiểm tra mọi nội dung nhưng cho phép viewport session thay đổi đúng thiết kế. Không bỏ kiểm tra ảnh/nội dung.

Sau polish: Mind Map matrix24/24 pass; connector bổ sung3/3 pass; Format Guide3/3 pass. Guide và schema tải xuống phản ánh namespace mới. Không thêm library.

## MM011 benchmark và release checks
Đo độc lập bằng node scripts/benchmark-mind-map.mjs mind và card, không chạy suite đồng thời.
Chrome154.0.8037.98; Windows10.0.26200; i5-10300H;32GiB;1440x900.
500nodes/2000relations, 4 kinds, ảnh ngang/dọc embedded, branch forest và references; JSON2,497,883bytes.
Mind Map: import903.5ms, Overview max85.5ms, pan median59.88FPS/10s.
Card Map: import764.7ms, Overview max84.8ms, pan median59.88FPS/10s.
Tất cả targets pass. Reports: mind-map-phase1-benchmark-mind.json và mind-map-phase1-benchmark-card.json.
Final syntax/lint, typecheck, format:check pass; build local vendors pass; core28/28. JSON schema asset khớp module; mixed example stage+validate pass. Không backend/upload/CDN/dependency mới.

## MM012 release gate
MM001–MM011 có evidence phía trên và reports/tests liên quan; đợt 1 nghiệm thu.
Manual layout, Root/branch/reference, image/text node, shared Detail, per-view geometry, vi/en/themes, CRUD/undo/recovery/round-trip được kiểm chứng.
Radial layout preview/collapse chưa triển khai, thuộc MM013–MM020. Không cam kết curve tránh mọi node. Mobile vẫn chỉ desktop notice theo V1.
