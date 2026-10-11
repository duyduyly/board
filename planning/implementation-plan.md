# Kế hoạch triển khai Visual Card Graph Editor

Ngày tạo: 2026-10-11. Phạm vi: triển khai V1 theo [đặc tả nâng cấp](../wordspace/docs/json-driven-visual-card-graph-editor-spec-v2.md). Phiên bản tài liệu là v2; định dạng dữ liệu là 1.0.

Checklist thực hiện: [implementation-checklist.csv](implementation-checklist.csv). Có 47 công việc V1, 4 task bổ sung E001–E004 theo yêu cầu và 10 công việc backlog V1.1/V2. Trạng thái thực được cập nhật trong CSV; evidence ở implementation-evidence.md.

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

- V1 hoàn tất: 47/47 task V1 và E001–E004 DONE có evidence; 10 mục V1.1/V2 giữ BACKLOG.
- Entry tại root index.html; CSS/JS, schema/example và vendor bundles local tại assets/.
- UI Việt/Anh có nút chuyển, giữ nguyên dữ liệu, draft và history khi đổi ngôn ngữ.
- Build, lint, kiểm tra contract TypeScript và format pass; core 21/21, UI 69/69 trên Chrome/Edge/Firefox, không flaky.
- Benchmark 500 cards/2.000 relations: import 626.2 ms, Overview max 106.4 ms, median pan 59.9 FPS; đạt cả ba target trên máy ghi trong evidence.
- Console QA không có lỗi/cảnh báo. IAB không khả dụng, đã dùng Playwright.
- README có hướng dẫn chạy/deploy static; chưa publish hosting. Mobile chỉ có thông báo dùng desktop.
- npm audit còn 2 cảnh báo mức low ở chuỗi Mermaid/KaTeX, được ghi rõ trong evidence; không có mức moderate/high/critical.
- Báo cáo nghiệm thu: [implementation-evidence.md](implementation-evidence.md).

## Ví dụ bổ sung theo yêu cầu

- E001: bộ card học quy tắc -s/-es và -ed, giải thích tiếng Việt với ví dụ tiếng Anh; thêm nút mở riêng, giữ ví dụ kiến trúc. DONE; đã kiểm tra hiển thị và round-trip trên Chrome/Edge/Firefox.

- E002: badge type/tags/số quan hệ, theme light/dark trong phiên, nút Fit toàn sơ đồ và Focus camera vào card/quan hệ được chọn; cập nhật README 1.0.0. Không thay dữ liệu JSON hoặc thực hiện chế độ lọc lân cận B103. DONE; 19 core và 57 browser tests pass, QA sáng/tối và benchmark đạt mục tiêu.

- E003: sửa trải nghiệm Dự án mới — nút luôn hiện trên desktop, dialog nhập tên, guard dữ liệu/draft và toast thành công. DONE; nút hiển thị desktop, dialog tên/guards/reset đã pass.

- E004: theo làm rõ của user, lưu ảnh PNG/JPEG/WebP/GIF bên trong JSON dưới namespace card-atlas:images; nút chèn từ máy, Markdown attachment:id, render Detail không request ngoài. Giữ JSON version 1.0 và giới hạn 10 MiB. DONE; ảnh nhúng hiển thị, portable round-trip và draft/history đã pass.
