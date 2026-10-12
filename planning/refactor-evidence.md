# Bằng chứng refactor RF001–RF005

Ngày 2026-10-12. Phạm vi: audit, common tái sử dụng, tách module và kiểm chứng; giữ root index.html, JSON 1.0, vi/en, commands/history và recovery opt-in.

## Kết quả triển khai

- app.js từ 1.853 xuống 1.396 dòng do tách trách nhiệm; đây không phải kết quả giảm bundle.
- Common: HTML escaping, clone, DOM query, download. UI: feedback/dialog, forms, Format Guide và sidebar. Detail: editor-fields. Graph: project-index dùng WeakMap theo committed snapshot.
- CSS tách base/theme/workspace, giữ thứ tự cascade. Adapter bỏ tính branchInfo khi chỉ đổi selection và dùng index thay lookup/degree lặp.
- Gate static imports: 27 module, không cycle, common không import tầng trên, module dưới không import app. Dynamic import không thuộc gate này.
- Giữ JSON clone riêng trong validator vì policy khác structuredClone.

## Kiểm chứng

Các lệnh dùng Node D:/program/nodejs/node.exe và tooling đã khóa trong repo:
- node --test tests/*-core.test.mjs tests/core.test.mjs: 36/36 PASS.
- Playwright full browser suite: 153/153 PASS, 51 mỗi Chrome/Edge/Firefox; report refactor-browser-results.json. Browser plugin không có, dùng Playwright của repo.
- scripts/check.mjs: syntax, ESLint/no-unused-vars và architecture PASS.
- tsc --noEmit và tsc -p tsconfig.modules.json: PASS. checkJs mới chỉ bao phủ common data/html và project-index, chưa toàn bộ UI.
- Prettier và scripts/build.mjs: PASS. git diff --check: PASS.
- Ban đầu local server chưa chạy gây ERR_CONNECTION_REFUSED; khởi động scripts/serve.mjs rồi chạy lại đạt. Không coi lần lỗi môi trường là evidence pass.
- Ảnh benchmark Card đã xem trực tiếp; regression browser kiểm tra theme, compact viewport, guards, draft, unsafe content, round-trip và interactions.

## Benchmark độc lập sau browser suite

Chrome 154.0.8037.98, Windows 10.0.26200, i5-10300H, RAM 32 GiB, viewport 1440×900. Dataset 500 node/2.000 relation, 2.497.883 byte.

| View | Import | Overview tối đa | Pan median |
|---|---:|---:|---:|
| Mind Map | 1.169,1 ms | 114,3 ms | 59,88 FPS |
| Card Map | 865,9 ms | 193,9 ms | 59,88 FPS |

Mind radial preview 681,3 ms, Apply 638,2 ms, 0 overlap. layoutSpread là cảnh báo dự kiến. Targets import ≤3s, Overview ≤200ms, pan ≥45FPS, layout ≤3s đều PASS. Không kết luận tăng tốc so với lần đo trước; thời gian có biến thiên. Report: refactor-benchmark-mind.json và refactor-benchmark-card.json; screenshots trong planning/design/.

## Giới hạn và hướng phát triển

app vẫn sở hữu orchestration/editor workflow. Tách controller tiếp khi feature thực tế yêu cầu, theo docs/development.md; không tạo abstraction/plugin registry trước nhu cầu. Không triển khai 10 BACKLOG. Không thêm dependency/framework/backend.

Nguồn chính thức: [MDN modules](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules), [Cytoscape batch](https://js.cytoscape.org/#cy.batch), [ESLint API](https://eslint.org/docs/latest/integrate/nodejs-api). Boundaries và cache là quyết định áp dụng cho repo.

RF001–RF005 DONE, không blocker trong phạm vi refactor.
