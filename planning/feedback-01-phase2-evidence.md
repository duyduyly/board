# Evidence Feedback01 đợt2

2026-10-12. Phạm vi FB011–FB016. FB011 contract frozen in plan/spec before code; contract fixtures and UI verification completed below. Không thêm schema/version/dependency.

Pure transfer contract tests8/8 PASS before browser integration: Root/views namespace filtering, explicit project exclusion, unused/pruned/dangling images, legacy/new invalid files, collision remap/cover/unknown merges, active-view size/atomic history, Add capacity and Markdown UTF8/limits/security/dataURI round-trip.

Chrome targeted8/8 PASS: Markdown/locale/security, invalid UTF8/limits/cancel, applied/draft export, unused/exclusion, Update/format/remap/cover/undo, Add dirtyguard and offline Markdown image+recovery. Initial detached preview bug corrected by deferred render after mount. UI no framework restyle; reuse existing native dialogs and token styling. Browser plugin absent, repo Playwright fallback as in phase1.

Final targeted27/27 (9/browser) PASS. Core46/46 including9 new transfer tests PASS. Lint/architecture32modules/typecheck/format/build PASS. Full matrix210 PASS; QA1050 và console kiểm trong recheck riêng. Tái dùng frontend-testing-debugging workflow, Browser plugin unavailable → Playwright. Không dùng ImageGen vì đây là controls/preview nhỏ trong dialog hiện có.

FullUI210/210 PASS (70/browser). Sau hardening malformed/empty attachment href, core transfer9/9 và relevantUI27/27 PASS. QA1050/accessibility/console3/3 PASS (preview accessible name vi/en, keyboard Escape, no horizontal overflow, buttons in viewport, no pageerror/consolewarning/error). Final reports phase2-browser-final/recheck/visual; không đổi/skips test để đạt pass.

## Benchmark cuối

Isolated sau UI: node scripts/benchmark-radial.mjs {card,mind} feedback-01-phase2. Windows11 10.0.26200, i5-10300H,32GiB, Chrome154.0.8037.98,1440×900;500mixed nodes/2000relations,2.50MB, embedded portrait/landscape và Markdown/Mermaid. Card import821.5ms,Overview max196.7ms,pan59.88FPS10s. Mind import1061.7ms,Overview118.8ms,pan59.88FPS,radial471.3ms,0overlap. Targets3s/200ms/45FPS/3s đạt, không đổi target. First Card cold sample215.3ms lưu benchmark-card-before; bỏ inherited backdrop blur trên native Detail/viewer (giữ dim background) giảm chi phí vẽ. Card gần gate, không hứa tốc độ mọi máy. Dataset chưa có shapes đợt3; full shape benchmark vẫn FB028.

## UX/visual QA

Xem screenshots: design/feedback-02-markdown-preview.png, feedback-02-markdown-1050.png, feedback-02-node-export.png, feedback-02-node-preview.png và feedback-02-node-preview-dark.png. Typography/palette/rounded border theo UI hiện có; transfer group collapsed trong Detail. Dialog780px max90vw, title/locale/Cancel/Confirm giữ visible; body/preview cuộn tài liệu dài, table so sánh metadata, warning/remap IDs và option scope rõ. Cả light/dark/vi/en và desktop1440/1050 đã kiểm tra; editor mobile vẫn notice. Không tạo artwork hoặc redesign mới. Console/network/storage: targeted preview không request evil.invalid; self-contained image workflow không request ngoài, storage mặc định0; chỉ opt-in recovery mới lưu, disable xóa.

## Files và limitations

json/node-transfer: transforms thuần và known-namespace policy; detail/markdown-import: UTF8 và Markdown staging; ui/document-transfer: files/preview/options nhận ports, không import app. app nối session/guards/geometry/commands; common clone/escape/download và existing feedback/Markdown sanitizer dùng chung. Feedback có accessible name theo title/locale. Không thêm dependency, JSON schema/version giữ1.0; vendor build unchanged.

README/FormatGuide có hướng dẫn và ví dụ assets/data/node-transfer-example.json (validated round-trip). AGENTS/development/plans/CSV cập nhật. Specv2 trong wordspace/docs cũng có contract FB011, nhưng wordspace bị user .gitignore nên không force-add; plan chứa đầy đủ contract để review trong commit. Unknown card namespace được giữ nhưng refs riêng không tự suy đoán/remap; relative images cần chèn từ máy; nhiều-card file dùng Import Project. ZIP/crop/shapes chưa thuộc đợt2. Không upload/backend/runtimeCDN/defaultpersistence mới. Local commit theo yêu cầu trước đó, không push.

Nguồn API chính thức: [MDN UTF8 TextDecoder/fatal](https://developer.mozilla.org/en-US/docs/Web/API/TextDecoder/fatal), [Marked lexer/walkTokens](https://marked.js.org/using_pro). Dùng dependency Marked18.1.0 đã pin, không cài package mới.

## Gate FB016

FB011–FB016 DONE,98DONE/13TODO/10BACKLOG trong master121task; không IN_PROGRESS/BLOCKED. Static/core46PASS và surface9/9 sau bỏ blur + accessible name PASS. Reports giữ full210, transfer27 recheck, visual3 và surface9 đúng phạm vi từng lượt; không claim full210 chạy lại sau từng polish. CSV BOM/CRLF/14columns/IDs/deps/acyclic/DONEevidence/dates và bản trích đều kiểm. README/Guide/example/AGENTS/spec/plan đồng bộ. Không blocker; đợt3–4 chưa thực hiện.
