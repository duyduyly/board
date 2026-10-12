# Kế hoạch triển khai Visual Card Graph Editor

Ngày tạo: 2026-10-11. Phạm vi: triển khai V1 theo [đặc tả nâng cấp](../wordspace/docs/json-driven-visual-card-graph-editor-spec-v2.md). Phiên bản tài liệu là v2; định dạng dữ liệu là 1.0.

Checklist thực hiện: [implementation-checklist.csv](implementation-checklist.csv). Có 47 công việc V1, 10 task bổ sung E001–E010, 20 task MM001–MM020 theo yêu cầu và 10 công việc backlog V1.1/V2. Trạng thái thực được cập nhật trong CSV; evidence ở implementation-evidence.md.

## Mục tiêu và giới hạn

Xây web editor chạy phía trình duyệt: import JSON, đọc và chỉnh sửa card/relation, xem Markdown/Mermaid, undo/redo và export để tiếp tục ở phiên sau. V1 không backend, tài khoản, tự lưu hoặc upload project.

Các giá trị vận hành trong spec (10 MiB/file, 500 cards, 2.000 relations, 100.000 ký tự Markdown/card, history 100 transaction/20 MiB) là cấu hình thiết kế ban đầu. Không tự đổi ngưỡng để vượt test; ghi quyết định và cập nhật contract nếu benchmark buộc phải thay đổi.

Entry bắt buộc là index.html ở gốc dự án. CSS, JavaScript và tài nguyên ứng dụng nằm trong assets/. T002 chọn graph library và cách dùng ES modules hoặc build tool phù hợp cấu trúc này; không chuyển entry sang src/app hoặc public/index.html. Khi triển khai phải kiểm tra tài liệu chính thức và khóa dependency; runtime không phụ thuộc CDN. Không bắt buộc React/Next.js/TypeScript: có thể dùng JavaScript modules với JSDoc/type checking; nếu chọn TypeScript thì assets build phải phục vụ root index.html.

## Thứ tự làm và điều kiện chuyển giai đoạn

| Giai đoạn | Công việc | Kết quả và điều kiện hoàn thành |
|---|---|---|
| P0 — Chuẩn bị | T001–T003 | Quyết định contract/stack được ghi lại; scaffold dev và static build chạy được |
| P1 — Hợp đồng dữ liệu và ngôn ngữ | T004–T008, T045 | Types/schema/validator/normalizer và fixtures nhất quán; example import hợp lệ; dictionaries vi/en dùng được |
| P2 — State và lịch sử | T009–T012 | Một project model; commands atomic; undo/redo; snapshot/draft/view state được tách đúng |
| P3 — Canvas | T013–T019, T046 | Card/edge hiển thị; pan/zoom/select; CRUD; connector tạo card+relation có undo chung; nút chuyển Việt/Anh hoạt động |
| P4 — Panel và nội dung | T020–T027 | Editors Apply/Cancel, guards, Markdown/Mermaid an toàn, điều hướng relation |
| P5 — Import/export | T028–T035 | Import staging/preview; replacement guards; download; Format Guide; round-trip bảo toàn dữ liệu |
| P6 — Hoàn thiện tương tác | T036–T038 | Search, keyboard và desktop UI dùng được; không phá nhập văn bản |
| P7 — Kiểm chứng và phát hành | T039–T044, T047 | E2E, security/network, browser compatibility, benchmark và static release gate |

Thứ tự trong CSV là thứ tự đề xuất, nhưng cột dependencies là điều kiện thực hiện. Chỉ bắt đầu task khi các phụ thuộc đã DONE. Một số công việc độc lập có thể thực hiện cùng thời điểm nếu nhóm có người, nhưng không bắt buộc phân công song song.

Không ước lượng ngày hoặc giờ trước khi biết nhân sự và kết quả prototype. Người thực hiện có thể bổ sung lịch sau P0, dựa vào phạm vi và khả năng thực tế.

## Lát cắt đầu tiên cần chạy được

Sau nền tảng P0–P2, ưu tiên một luồng nhỏ có thể xem trực tiếp: import example → canvas → sửa title/content → export → import lại.

Để có demo sớm, thực hiện T013–T017, T020–T024 và T028–T035 theo phụ thuộc. Khi làm theo thứ tự giai đoạn đầy đủ, luồng này hoàn tất ở P5. Trong lúc demo chưa hoàn thiện guards hoặc Mermaid, phải ghi rõ giới hạn; không coi demo là đạt V1.

Lát cắt này chứng minh schema, adapter, editor, snapshot và serializer phối hợp với nhau. Sau đó hoàn thành mọi task V1 còn lại trước release.

## Cấu trúc code bắt buộc

```text
index.html                   # entry ứng dụng ở root
AGENTS.md                    # quy trình làm việc cho agents
planning/
  implementation-plan.md
  implementation-checklist.csv
assets/
  css/                       # base, layout, canvas, panel, components
  js/
    app.js                   # bootstrap
    graph/                   # model, commands, history, queries
    json/                    # schema, validation, normalization, import/export
    store/                   # project và session state
    canvas/                  # renderer adapter và interactions
    detail/                  # editors, Markdown, Mermaid
    ui/                      # toolbar, sidebar, dialogs, search
    i18n/                    # vi.js, en.js, translator và locale state
  data/                      # JSON schema, example, AI guide assets
  vendor/                    # thư viện local nếu không dùng bundler
  images/                    # icons/hình nếu cần
tests/                       # fixtures, integration, e2e
```

Các thư mục con được tạo khi cần. index.html chứa cấu trúc entry và liên kết assets; không nhồi toàn bộ CSS/JS vào inline blocks. Không viết sản phẩm vào planning/ hoặc wordspace/. Khi dùng build tool, ghi rõ source/output trong assets và luôn giữ index.html ở root làm entry. Mọi mutation dữ liệu đi qua command; renderer không giữ bản project thứ hai.

## Tiếng Việt và tiếng Anh trong V1

- Ngôn ngữ mặc định là tiếng Việt (vi); toolbar có nút hoặc control Tiếng Việt / English luôn dễ tìm và dùng được bằng bàn phím.
- Chuyển locale ngay trong phiên, không reload. Cập nhật html lang, labels, tooltips, aria labels, validation messages, dialogs, toast, loading/empty/error states, tên tab, Format Guide và hướng dẫn AI. Chỉ dịch phần giao diện do ứng dụng cung cấp.
- Giữ nguyên title, summary, tags, type tự nhập, Markdown, Mermaid và nội dung relation của người dùng. Không đổi JSON keys, IDs, version, enum values hoặc lỗi path/code. Thông báo lỗi có message dịch được và path/code ổn định.
- Locale thuộc session state: switch không làm dirty, không vào undo, không đổi viewport/selection/draft và không nằm trong export. Reload trở về vi; không thêm persistence cho ngôn ngữ trong V1.
- Dùng dictionaries assets/js/i18n/vi.js và en.js cùng bộ key, một hàm t(key, params); tránh nối chuỗi câu gây lỗi thứ tự từ. Dùng Intl cho số/ngày trong UI; dữ liệu JSON vẫn dùng định dạng máy đọc.
- Dictionary key thiếu fallback sang vi và được báo trong môi trường dev; kiểm tra key parity trước release. Không gửi nội dung tới dịch vụ dịch.
- Test các luồng import/edit/undo/export/guards ở cả hai locale, switch khi draft chưa Apply và khi dialog đang mở. Kiểm tra chữ Việt/Anh không tràn, nhãn bàn phím đọc được, export không thay đổi chỉ do switch. Dialog beforeunload native theo ngôn ngữ browser, không cam kết control được nội dung hoặc locale của nó.

T045 chuẩn bị nền tảng, T046 gắn switch vào UI, T047 nghiệm thu. Các task UI còn lại dùng translator từ lúc code, không đợi cuối V1 mới thay chuỗi.

## Quyết định cần ghi rõ tại T001

1. Position object có x/y đầy đủ: thiếu cả object được normalize; thiếu một thành phần báo lỗi. Trường hợp partial khác phải có chính sách rõ trong schema/default tests.
2. Grid cho vị trí thiếu phải tính bounding box từ size đã normalize và giữ nguyên các vị trí có sẵn.
3. Export Current trong replacement guard tiếp tục thay project chỉ sau khi bước export không lỗi; nếu draft còn chưa Apply thì phải xử lý lựa chọn draft trước. Browser download initiated không phải bằng chứng file đã lưu trên đĩa.
4. Đo ngân sách history bằng representation được chọn, ghi rõ overhead được tính hay không; test eviction và transaction vượt ngân sách. Thay đổi policy cần sửa spec trước code.
5. Panel References/status chỉ thuộc V1.1. V1 không thêm schema fields mới chưa có contract. Phần mở rộng tương lai phải chốt version/migration trước khi viết dữ liệu mới.

## Cách dùng checklist CSV

File dùng UTF-8 BOM, dấu phẩy và CRLF để đọc tiếng Việt trong Excel. Nếu Excel không tự tách cột, dùng Data → From Text/CSV với encoding UTF-8 và delimiter comma. Dependencies ngăn cách bằng dấu chấm phẩy trong một ô.

| Cột | Ý nghĩa |
|---|---|
| task_id | ID ổn định; không đổi khi sắp xếp bảng |
| phase | P0–P7 cho V1; P8/P9 cho backlog |
| release | V1, V1.1 hoặc V2 |
| task | Tên công việc |
| scope | Phần cần thực hiện |
| dependencies | Các task phải hoàn thành trước |
| acceptance_criteria | Kết quả cụ thể để đánh dấu DONE |
| verification | Cách kiểm chứng phù hợp |
| spec_sections | Số mục trong đặc tả nâng cấp |
| status | TODO, IN_PROGRESS, BLOCKED, DONE hoặc BACKLOG |
| owner | Người thực hiện; để trống khi chưa phân công |
| evidence | Commit/PR, test report hoặc ảnh QA chứng minh kết quả |
| completed_at | Ngày hoàn thành yyyy-mm-dd; chỉ điền khi DONE |
| notes | Vướng mắc, quyết định hoặc lý do điều chỉnh |

CSV không có công thức hoặc cơ chế tự kiểm dependencies. Khi đổi trạng thái, người thực hiện phải rà phụ thuộc và tiêu chí. Không đánh dấu DONE chỉ vì code đã viết; phải có bằng chứng kiểm chứng tương ứng. BLOCKED cần ghi lý do và bước tháo gỡ. V1.1/V2 giữ BACKLOG cho đến khi V1 đạt release gate.

## Chiến lược kiểm chứng

Unit tests tập trung vào logic có hậu quả: validation, normalization, graph invariants, atomic commands, history budgets, dirty snapshots và serializer. Không cần test chỉ lặp lại từng chi tiết trình bày.

Integration tests kiểm tra import/edit/export/reimport, defaults và extensions, export lỗi/cancel, draft/replacement guards. E2E kiểm tra drag/click, connector, navigation, shortcuts, beforeunload theo browser và downloads.

QA nội dung kiểm tra HTML/link/ảnh không an toàn, Mermaid lỗi và race khi đổi selection. Theo dõi network/storage để chứng minh không upload hoặc persistence ngầm. Không tạo local recovery chỉ để làm test thuận tiện.

Benchmark dùng dataset có thể tái tạo gồm 500 cards/2.000 relations, nội dung có phân bố đại diện và một card gần giới hạn. Ghi máy, OS, browser/version, lượt đo và kết quả. Mục tiêu theo spec: import-to-interactive ≤3 giây; mở Overview ≤200 ms không tính Mermaid; median pan/drag ≥45 FPS trong 10 giây. T043 xử lý chênh lệch bằng số đo rồi chạy lại kiểm tra liên quan.

## Điều kiện hoàn thành V1

- T001–T047 đều DONE với evidence; không có lỗi blocking chưa xử lý.
- Root index.html và assets chạy đúng; lint, type checking, tests và build nếu có pass trên cùng bản code phát hành.
- Toàn bộ UI hỗ trợ vi/en, có nút chuyển và T047 đã nghiệm thu.
- JSON Schema, example và AI Instructions cùng hợp đồng 1.0; round-trip không mất dữ liệu.
- Desktop Chrome/Edge/Firefox được kiểm tra và ghi version; mobile editor chưa có cam kết.
- Các đường rời draft, thay project, export và undo đúng; dữ liệu không tự lưu hoặc gửi đi.
- Benchmark có kết quả thực và mọi thay đổi target được ghi quyết định.
- README giải thích dữ liệu phiên, export/import, giới hạn và chạy/deploy static.

Build và hướng dẫn deploy thuộc kế hoạch. Đưa lên hosting cụ thể cần xác định môi trường và quyền truy cập khi đến bước triển khai; không mặc định publish từ nhiệm vụ tạo plan.

## Backlog sau V1

P8 gồm B101–B106: multi-select, filter, Focus, minimap/auto-layout, References/review status và templates/context menu.

P9 gồm B201–B204: saved views/migrations, adapters CSV/indexer, diff/statistics và export hình ảnh. Đây là đầu việc định hướng; cần chia nhỏ và nghiệm thu chi tiết khi bắt đầu phiên bản đó.

AI gọi model trực tiếp, cloud, login, collaboration và recovery local không nằm trong checklist hiện tại.

## Tiến độ hiện tại

- V1 hoàn tất: 47/47 task V1 và E001–E008 DONE có evidence; 10 mục V1.1/V2 giữ BACKLOG.
- Entry tại root index.html; CSS/JS, schema/example và vendor bundles local tại assets/.
- UI Việt/Anh có nút chuyển, giữ nguyên dữ liệu, draft và history khi đổi ngôn ngữ.
- Build, lint, kiểm tra contract TypeScript và format pass; core 23/23, UI 93/93 trên Chrome/Edge/Firefox, không flaky.
- Benchmark 500 cards/2.000 relations: import 649 ms, Overview max 79.7 ms, median pan 59.9 FPS; đạt cả ba target trên máy ghi trong evidence.
- Console QA không có lỗi/cảnh báo. IAB không khả dụng, đã dùng Playwright.
- README có hướng dẫn chạy/deploy static; chưa publish hosting. Mobile chỉ có thông báo dùng desktop.
- npm audit còn 2 cảnh báo mức low ở chuỗi Mermaid/KaTeX, được ghi rõ trong evidence; không có mức moderate/high/critical.
- Báo cáo nghiệm thu: [implementation-evidence.md](implementation-evidence.md).

## Ví dụ bổ sung theo yêu cầu

- E001: bộ card học quy tắc -s/-es và -ed, giải thích tiếng Việt với ví dụ tiếng Anh; thêm nút mở riêng, giữ ví dụ kiến trúc. DONE; đã kiểm tra hiển thị và round-trip trên Chrome/Edge/Firefox.

- E002: badge type/tags/số quan hệ, theme light/dark trong phiên, nút Fit toàn sơ đồ và Focus camera vào card/quan hệ được chọn; cập nhật README 1.0.0. Không thay dữ liệu JSON hoặc thực hiện chế độ lọc lân cận B103. DONE; 19 core và 57 browser tests pass, QA sáng/tối và benchmark đạt mục tiêu.

- E003: sửa trải nghiệm Dự án mới — nút luôn hiện trên desktop, dialog nhập tên, guard dữ liệu/draft và toast thành công. DONE; nút hiển thị desktop, dialog tên/guards/reset đã pass.

- E004: theo làm rõ của user, lưu ảnh PNG/JPEG/WebP/GIF bên trong JSON dưới namespace card-atlas:images; nút chèn từ máy, Markdown attachment:id, render Detail không request ngoài. Giữ JSON version 1.0 và giới hạn 10 MiB. DONE; ảnh nhúng hiển thị, portable round-trip và draft/history đã pass.

- E005: áp dụng mô tả Card overview của user; action mở Detail Overview, title 2 dòng/summary 3 dòng, tag nhẹ và handle hover; zoom ảnh Detail khi hover bằng preview nổi không bị panel clip. DONE; hover 100% natural size, ảnh lớn cuộn; default card mới 260 × 190, custom size giữ nguyên. 21 core và 75 UI pass; evidence: planning/card-preview-evidence.md.

- E005 nghiệm thu: 52 DONE (47 V1 + 5 bổ sung), 10 BACKLOG; không có task đang dở. README và card-design.md đồng bộ; chưa push remote vì yêu cầu phê duyệt trước đó chưa được trả lời.

## Nâng cấp trải nghiệm viết tài liệu — E006/E007

User yêu cầu thực hiện các cải thiện sau review. E006 DONE: giữ selection/cursor/scroll theo card khi render; nút Viết tập trung với metadata gọn và preview draft; tìm toàn văn có snippet; mục lục headings; template append an toàn; export Markdown tự chứa ảnh. E007 DONE: recovery cục bộ **chỉ khi người dùng bật rõ ràng**, dùng IndexedDB và marker opt-in, lưu project và draft theo debounce, restore chủ động và xóa khi tắt. Không backend/upload/cloud; JSON 1.0 và giới hạn không đổi. Chính sách không persistence mặc định vẫn giữ; opt-in recovery là bổ sung được user yêu cầu sau review. Export JSON vẫn cần kiểm tra file tải xuống; recovery không thay bản sao JSON. Backlog khác giữ nguyên.

- E006/E007 nghiệm thu:54 DONE (47 V1 +7 bổ sung),10 BACKLOG; không có task đang dở. Build/lint/typecheck/format pass; core22/22, UI87/87; QA light/dark/1050/mobile notice không console lỗi/cảnh báo; benchmark đạt mục tiêu. Evidence: [writing-upgrade-evidence.md](writing-upgrade-evidence.md). Chưa push remote.

## E008 — Detail Format và hình dạng Card

DONE theo user: tab Format riêng gồm width/height, nền/chữ/viền, radius0–100px, borderWidth0–8px, titleFontSize12–24px, alignment left/center/right, shadow none/soft; presets rectangle/rounded. Size dùng contract hiện có; appearance trong extensions card-atlas:appearance có validate typed/bounds, không nhận CSS tùy ý. Edit/Format dùng chung draft; Apply/Cancel/guard/undo/JSON roundtrip. Toolbar content bold/italic/inline code và color cú pháp [text]{color:#RRGGBB}; tokenizer riêng, render text escaped và chỉ set color hex sau sanitize, HTML tùy ý vẫn bị escape. UI vi/en, preview hình dạng trong Format trước Apply.

- E008 nghiệm thu:55 DONE (47V1+8 bổ sung),10 BACKLOG; không task đang dở. Core23/23, fullUI93/93 + targeted6/6 sau polish preview; lint/typecheck/format pass. Console QA sạch, desktop1440/1050 và mobile notice390. Evidence: [detail-format-evidence.md](detail-format-evidence.md). README hướng dẫn Format/text colors; chưa push remote.

## Illustrated Mind Map và node ảnh — 2026-10-12

Plan: [mind-map-plan.md](mind-map-plan.md). Checklist riêng: [mind-map-checklist.csv](mind-map-checklist.csv), tái tạo từ checklist chính mỗi lần cập nhật.
MM001–MM012 DONE: bốn kiểu node/ảnh độc lập, Card Map và Mind Map thủ công, graph/Detail dùng chung, geometry riêng, Root/branch/reference và đầy đủ thao tác.
MM013–MM020 DONE: đợt 2 đã nghiệm thu radial layout preview và collapse; regression/benchmark pass. B104/B201 vẫn BACKLOG ngoài scope đã tách.

### Tiến độ hiện tại

75 DONE,10 BACKLOG; không TODO/IN_PROGRESS/BLOCKED trong phạm vi đã giao. Đợt 2: pure radial layout, preview Apply/Cancel/Reset, atomic undo, collapse session/count/search reveal, vi/en và light/dark; không đổi JSON1.0 hay Card Map geometry.
Files: index.html; assets/js/graph/radial-layout.js, app, adapter, store, i18n; assets/css; README/AGENTS; core/browser tests; prototype/benchmark scripts và planning evidence.
Core33/33, lint/typecheck/format/build pass. Benchmark500/2000 hai view pass; Mind preview647ms,0overlap,pan59.88FPS. Full UI147/147 Chrome/Edge/Firefox pass.
Evidence: [mind-map-phase2-evidence.md](mind-map-phase2-evidence.md). Đợt 2 hoàn tất; task tiếp theo chỉ khi user giao scope mới. Không thực hiện BACKLOG.

## E009 — màu trong suốt

User yêu cầu thêm lựa chọn trong suốt. Dùng boolean backgroundTransparent/borderTransparent trong namespace card-atlas:appearance, defaultfalse; style hex giữ nguyên để bỏ chọn phục hồi màu. Format/Edit có checkbox vi/en cho nền và viền; text vẫn đọc được. Áp dụng cả hai view/theme/preview, loại bỏ shadow nền trong suốt. E009 DONE;76DONE/10BACKLOG, không blocker/task đang dở. Core34/34; targeted UI9/9 Chrome/Edge/Firefox; lint/typecheck/format pass. Files: appearance/app/i18n/CSS, README/tests và planning. Evidence: [transparency-evidence.md](transparency-evidence.md). Task tiếp theo chỉ khi user giao scope mới.

## E010 — English example user

Thay assets/data/english-endings-example.json bằng JSON user:12 text nodes,Root,11branch/1reference,Usage/Spelling/Pronunciation/Mistakes/Practice12/Answers. Bỏ ký tự rác sau JSON theo user; không sửa nội dung học hoặc tự tải ảnh URL. E010 DONE;77DONE/10BACKLOG, không blocker/task đang dở. Files: English JSON/README/tests/fixture/planning/spec. Validator/roundtrip,core34/34,UI12/12 Chrome/Edge/Firefox và lint pass. Evidence: [english-example-update-evidence.md](english-example-update-evidence.md). Task tiếp theo chỉ khi user giao scope mới.

## Refactor source — RF001–RF005

User giao audit/plan/optimize/restructure; xem [refactor-plan.md](refactor-plan.md). RF001–RF005 DONE; tổng 82 DONE, 10 BACKLOG, không task đang dở hoặc blocker trong phạm vi được giao. Core 36/36, full UI 153/153 Chrome/Edge/Firefox, lint/architecture/typecheck/format/build và benchmark hai view PASS. Files: common/, ui/, editor-fields, project-index, CSS layers, scripts/architecture.mjs, tests và docs/development.md. Evidence: [refactor-evidence.md](refactor-evidence.md). Task tiếp theo chỉ khi user giao scope mới; giữ BACKLOG.

## Feedback 01 — đợt 1

User giao implement FB001–FB010 ngày2026-10-12, đã DONE. [feedback-01-plan.md](feedback-01-plan.md) và master/checklist trích đồng bộ. Gallery6template local/Home/Continue/categories, Detail native75%/Full, single select/Open và click viewerFit/100% đã triển khai; guards/history/JSON1.0/recovery opt-in giữ nguyên. Tái sử dụng dialog lifecycle; offscreen paint trên graph lớn tối ưu để pan đạt60FPS.

Tiến độ hiện tại:92DONE/19TODO/10BACKLOG; không IN_PROGRESS/BLOCKED. Core37/37; fullUI180/180 + portrait/GIF3/3 Chrome/Edge/Firefox; lint/architecture29modules/typecheck/format/build PASS. Benchmark500/2000 hai view PASS, không đổi targets. Files: index.html, assets/css/js/catalog/templates/previews, tests/ui-driver, benchmark script, README/AGENTS/development và planning. Evidence: [feedback-01-phase1-evidence.md](feedback-01-phase1-evidence.md). Không blocker. FB011–FB029 chưa được giao code; bước tiếp FB011 khi user giao đợt2. BACKLOG cũ giữ nguyên; không push remote.

## Feedback01 — đợt 2

User giao FB011–FB016 ngày2026-10-12, đã DONE. MarkdownUTF8 import Replace/Append vào draft với preview/cancel/security/relative-images; dataURI raster convert attachments. Portable node export applied(default)/draftexplicit, ảnh/cover/unused option và project namespace exclusion consent. Node Update giữ ID/relations/geometry mặc định; format option chỉ size active view; collisions remap và unknown card conflicts explicit. Update Apply/Undo atomic; Add ID mới/viewport/draftguard/oneUndo, không Root/branch.

Tiến độ hiện tại:98DONE/13TODO/10BACKLOG, không IN_PROGRESS/BLOCKED. Core46/46, fullUI210/210 Chrome/Edge/Firefox + relevant transfer27/27 và surface9/9 rechecks, static/typecheck/format/build PASS. Benchmark500/2000 hai view PASS: Card821.5ms/Overview196.7ms/pan59.88FPS; Mind1061.7ms/118.8ms/59.88FPS/radial471.3ms/0overlap. Files: assets JS/CSS/example, tests, README/AGENTS/development và planning. Evidence: [feedback-01-phase2-evidence.md](feedback-01-phase2-evidence.md). Không blocker. Tiếp theo FB017 chỉ khi user giao đợt3; FB017–FB029 và BACKLOG chưa triển khai. Commit local, không push.

## Feedback01 — đợt3 hoàn tất

FB017–FB023 DONE ngày2026-10-13: 8 basic shapes, palette/search drawer, shared geometry/overview/image upload, atomic resize, font12–72 và Manual/Fit text. Tiến độ105DONE/6TODO/10BACKLOG; không task đang dở trong đợt3. Core51/51; fullUI231/231 trước sửa wrap, toàn bộ shapes18/18 sau sửa wrap; static/typecheck/format/build PASS. Benchmark smoke500/2000 cả hai view đạt targets, chi tiết trong [feedback-01-phase3-evidence.md](feedback-01-phase3-evidence.md). Files: index, assets CSS/JS/schema/example, tests, benchmark script, README/AGENTS/development và planning. FB024–FB029 chưa triển khai; mở đợt4 đang chờ xác nhận trực tiếp theo automatic approval review. Không thay BACKLOG.
