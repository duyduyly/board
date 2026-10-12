# Evidence Feedback 01 — đợt 1

Ngày 2026-10-12. Phạm vi người dùng giao: FB001–FB010. Đợt 2–4 chưa triển khai. Browser plugin không có trong phiên; dùng Playwright của repository trên Chrome/Edge/Firefox. Giữ artifact theo AGENTS.md.

## Kết quả triển khai

- Home Gallery: 6 template JSON local, Personal/Learning/Work/Project, categories, preview 4:3 từ map thật, skeleton/error/Retry/empty. Template stage+validate trước replace; Home/Continue giữ session và replacement guards.
- Detail native dialog giữa 75vw/max1120px/max90vh, Full, body đọc 80ch; giữ Overview/Edit/Format, TOC, Mermaid, draft preview/caret/scroll. Canvas inert; X/Escape/backdrop cùng guard. Locale/theme và project tools dùng controls trong dialog.
- Mọi node Card/text/image single click chọn; double click/Open/Enter mở Detail. Drag/connector không mở nhầm. Sidebar là navigation mở trực tiếp.
- Viewer click/keyboard, Fit tối đa75vw×75vh không upscale, 100% có cuộn; body ảnh contain360px. Escape đóng viewer trước, focus về ảnh; không mở khi hover và không fetch thêm chỉ vì mở viewer.
- Chung lifecycle top-layer/backdrop/focus ở ui/dialog-surface.js; catalog/gallery controller độc lập app, không thêm dependency. JSON1.0/history/recovery opt-in giữ nguyên.
- Benchmark phát hiện offscreen DOM cards repaint trên graph500node. Adapter bỏ qua paint ngoài viewport ở map≥200node (margin120px; giữ focused node), transform layer composited; không bỏ node/model/edge/geometry. Browser test chứng minh Focus hiện lại node và project không đổi.

## Verification

Baseline trước code: core36/36, Chrome3/3. Prototype native Detail/viewer/guard targeted21/21. Final core37/37. Commands: node --test tests/*-core.test.mjs tests/core.test.mjs; node scripts/check.mjs; tsc --noEmit; tsc -p tsconfig.modules.json; prettier --check index.html assets/css assets/js scripts tests playwright.config.js eslint.config.js; node scripts/build.mjs. Tất cả PASS:29module, no cycles/upward import, lint/typecheck/format/build.

Final matrix:180/180 PASS Chrome/Edge/Firefox (60/browser), including large-map paint/focus regression. Bổ sung portrait/GIF3/3 PASS, tổng183 browser checks. Reports: feedback-01-phase1-browser-final.json và feedback-01-phase1-browser-images.json. Portrait giữ ratio1:5 trongFit, GIF1×1 không upscale, viewer không thêm request; Escape/backdrop và focusreturn pass. Lần full đầu174/177, ba lỗi test còn selector welcome cũ; sửa selectors rồi targeted3/3PASS. Báo cáo cũ feedback-01-phase1-browser-results.json và recheck feedback-01-phase1-browser-recheck.json được giữ minh bạch; final report lưu riêng. Supplementary test ban đầu chọn nhầm GIF do thứ tự chèn, sửa locator theo alt filename rồi3/3PASS. Không bỏ/skips coverage để đạt pass. tests/ui-driver.mjs chỉ dùng visible controls, không bypass inert; fixture benchmark/core dùng model để tạo dataset.

## Hiệu năng

node scripts/benchmark-radial.mjs mind feedback-01-phase1; node scripts/benchmark-radial.mjs card feedback-01-phase1. Windows11 10.0.26200, i5-10300H,32GiB, Chrome154.0.8037.98,1440×900.500mixed nodes/2000relations,2.50MB, embeddedportrait/landscape và Markdown/Mermaid.

| View | Import | Overview max5 mẫu | Pan median10s | Radial preview | Overlap |
|---|---:|---:|---:|---:|---:|
| Card Map |809.2ms|197.5ms|59.88FPS|n/a|n/a|
| Mind Map |1065.8ms|105.5ms|59.88FPS|466.5ms|0|

Targets import≤3s,Overview≤200ms,pan≥45FPS,radial≤3s đạt, không đổi targets. JSON reports feedback-01-phase1-benchmark-{card,mind}.json; before report Mind12FPS lưu để trace. Benchmark sau đóng dialog, canvas thực sự visible; không đo canvas Home bị hidden. Shape registry chưa thuộc đợt1 nên dataset giữ kinds hiện có. Card Overview sát gate; số đo là môi trường này, không hứa mọi máy.

## Visual QA và fidelity

Dùng skill frontend-app-builder/frontend-testing-debugging và imagegen: concept built-in ImageGen lưu design/feedback-01-gallery-concept.png, feedback-01-detail-concept.png. Prompt: Card Atlas palette/SegoeUI, Gallery sáu map/categories và Detail75%/Full/locale/theme; không marketing. Xem ảnh concept và actual desktop/light/dark/mobile/Detail/viewer.

| Điểm so sánh | Kết quả |
|---|---|
| Palette/type | Giữ brand hiện có, green neutral và SegoeUI; h1Gallery32px, titleDetail20px, body16px/1.65; cảlight/dark đọc rõ |
| Gallery hierarchy | Preview4:3,title2lines,gap24px,radius12px; desktop4cols theo plan, khác concept3cols có chủ đích |
| Nội dung preview | SVG từ model thực, không dùng ảnh concept thay dữ liệu; overview labels nhỏ trên map lớn là thumbnail, title tile rõ |
| Detail/focus | Dialog75%/Full/body80ch, backdrop/fixedtabs/footer và focus; giữ TOC/Mermaid/user content, không thêm date/minimap/content do concept tự sinh |
| Responsive/viewer | Gallery1440/900/600/390 không horizontal overflow,390singlecol; editor vẫn desktop notice. ViewerFit/100%, không crop hoặc hoverpopup |

Actual: design/feedback-01-gallery.png, feedback-01-gallery-dark.png, feedback-01-gallery-mobile.png, feedback-01-detail.png, feedback-01-image-viewer.png. Existing regression screenshots cũng được refresh; tên artifact hover lịch sử vẫn giữ nhưng screenshot hiện dùng click viewer. Không tuyên bố pixel-identical concept.

## Contract/docs

Phase1 contract đồng bộ specv2 trong wordspace/docs (thư mục bị user .gitignore, không force-add). Transfer/shape contract để FB011/FB017. README/AGENTS/development và plans/checklists phản ánh Gallery/dialog/viewer. Không upload, không backend, không runtimeCDN hoặc defaultstorage mới. Local commit theo yêu cầu user trước; không push.

Native dialog implementation tham khảo [MDN dialog](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/dialog) và [WAI Modal Dialog Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/). Không thêm library mới.

## Gate FB010

FB001–FB010 DONE;92DONE/19TODO/10BACKLOG trong master121task. CSV/master/bản trích kiểm traBOM/CRLF/14cols/IDs/dependencies/acyclic/evidence/date. Không task IN_PROGRESS/BLOCKED trong phạm vi được giao. FB011–FB029 giữTODO, BACKLOG cũ giữ nguyên. Không có blocker.
