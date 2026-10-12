# Optimize và tái cấu trúc source

2026-10-12. User giao audit, lập kế hoạch và thực hiện. Giữ root index.html + assets, vanilla ESM, JSON 1.0, song ngữ, commands atomic và recovery opt-in. Không thêm framework, dependency hay backend.

## Đánh giá source

- app.js ban đầu 1.853 dòng, quản lý cả orchestration, markup, dialog và downloads. CSS 1.443 dòng trộn base/theme/features.
- HTML escaping trùng trong app/Markdown; structuredClone trùng app/store; đếm degree trùng sidebar/adapter; ba handler tải tài nguyên của Guide giống nhau.
- Adapter tính branchInfo cả khi chỉ đổi selection; cleanup gọi cards.some trong vòng lặp. Detail tìm peer bằng cards.find và lọc toàn bộ relations cho mỗi hướng.
- Contract/commands/history và security renderer đã có tests, nên giữ các ranh giới này. JSON clone của validator có semantics khác structuredClone, không gom máy móc.

## Kiến trúc lựa chọn

ESM theo trách nhiệm: common cho primitive thuần/browser I/O, ui sở hữu dialog/forms/sidebar/Guide, detail dựng fields thuần, graph cung cấp query index, app điều phối session và commands. Không dùng service locator hay plugin registry chưa có nhu cầu. CSS tách base/theme/workspace, giữ nguyên cascade và selectors.

Nguồn chính thức: [MDN modules](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules) và [Cytoscape batching/performance](https://js.cytoscape.org/#cy.batch). Boundaries/cache là lựa chọn áp dụng cho repo, không phải kiến trúc bắt buộc từ thư viện.

## Plan/checklist

RF001 audit/plan → RF002 common/UI feedback → RF003 fields/Guide → RF004 index/sidebar/CSS → RF005 architecture gate, regression và benchmark. Master implementation-checklist.csv là nguồn tiến độ chính. Không triển khai BACKLOG.

Acceptance: giữ UI/contract, guards, Undo, JSON round-trip, vi/en, themes và recovery. Full browser matrix và core phải đạt; benchmark chạy riêng, giữ targets import≤3s, Overview≤200ms, pan≥45FPS và layout≤3s. Query cache WeakMap chỉ đọc committed snapshot, không serialize. Chỉ gom common khi có caller thật và policy giống nhau.

## Tiến độ hiện tại

RF001–RF005 DONE. Core 36/36, UI 153/153 Chrome/Edge/Firefox, lint/architecture, typecheck, format và build PASS. Benchmark 500/2.000 ở hai view đạt toàn bộ targets; xem [refactor-evidence.md](refactor-evidence.md). Files: common/, ui/, editor-fields, project-index, CSS layers, architecture checker/tests và docs/development.md. Không blocker; không thực hiện BACKLOG. Task tiếp theo chỉ khi user giao phạm vi mới.
