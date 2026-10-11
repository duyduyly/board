# Card Atlas — Version 1.0.0

**Phiên bản hiện tại: 1.0.0.** Card Atlas là trình biên tập đồ thị trực quan chạy phía trình duyệt, dùng JSON để lưu các card và quan hệ. Bạn có thể xây bản đồ kiến thức, ghi chú học tập, luồng công việc hoặc tài liệu kiến trúc hệ thống. Giao diện hỗ trợ **Tiếng Việt / English**, **Light / Dark mode**.

## Tính năng

- Tạo, chỉnh sửa, kéo thả, nhân bản và xóa card; nối card bằng quan hệ có nhãn, màu và hướng mũi tên.
- Card có badge loại, tag và số quan hệ; tag dài được rút gọn và có tooltip.
- Panel đọc Markdown, bảng và sơ đồ Mermaid; editor có Apply/Cancel để quản lý bản nháp.
- Undo/Redo cho các thao tác dữ liệu; xóa card và các quan hệ được phục hồi cùng nhau.
- Tìm theo title, summary, type và tags.
- Pan/zoom; **Fit** toàn bộ sơ đồ; **Focus** đưa card hoặc quan hệ đang chọn vào giữa khung nhìn.
- Import JSON có validation và preview; export JSON để lưu và tiếp tục ở phiên sau.
- Format Guide cung cấp schema và hướng dẫn tạo dữ liệu bằng AI.
- Hai ví dụ: kiến trúc hệ thống và bài học **-s/-es, -ed** gồm 11 card, 13 quan hệ và 10 câu luyện tập có đáp án.

## Chạy local

Yêu cầu Node.js hỗ trợ dependency trong package-lock.json; đã kiểm tra với Node **25.8.2**. Chrome/Edge/Firefox desktop là môi trường mục tiêu.

```sh
npm ci
npm run build
npm run dev
```

Mở **http://127.0.0.1:4173**. Nếu thư viện local đã được build, các lần chạy sau chỉ cần npm run dev. Không mở index.html bằng file://: ES modules, JSON và renderer cần static HTTP server. Server dev chỉ bind 127.0.0.1 và phục vụ file; không có API lưu project.

## Hướng dẫn sử dụng

### Bắt đầu

Chọn **Bắt đầu trống**, **Mở ví dụ**, **Ví dụ tiếng Anh: -s/-es và -ed**, hoặc **Nhập project JSON** trên màn hình bắt đầu. Nếu đang có project, dùng Nhập JSON để mở file khác; ứng dụng sẽ cảnh báo khi thay thế dữ liệu chưa export.

File bài học có thể tải/import riêng tại [english-endings-example.json](assets/data/english-endings-example.json). Giải thích bằng tiếng Việt với công thức và ví dụ tiếng Anh. Chuyển ngôn ngữ giao diện không dịch nội dung card.

### Card và quan hệ

1. Bấm **Thẻ mới** để tạo card. Click card để đọc; double click hoặc chọn **Chỉnh sửa** để sửa title, summary, type, tags, màu và nội dung.
2. Chọn **Áp dụng** để lưu thay đổi vào project trong phiên, hoặc **Hủy** để bỏ bản nháp. Đổi ngôn ngữ/theme giữ nguyên bản nháp.
3. Kéo card trên canvas để đổi vị trí.
4. Dùng **Kết nối**, chọn card nguồn rồi card đích; hoặc kéo chấm nối bên cạnh card. Thả vào vùng trống tạo card mới và quan hệ trong một thao tác undo.
5. Click đường nối để đọc/sửa relation. Xóa card sẽ xóa các relation liên quan.
6. Dùng Undo/Redo để quay lại hoặc thực hiện lại thao tác dữ liệu.

Badge phía trên hiển thị type và số quan hệ đi vào/đi ra. Dưới card có tối đa hai tag không trùng type; **+N** hiển thị các tag còn lại qua tooltip.

### Điều hướng sơ đồ

- Cuộn chuột trên canvas để zoom; dùng **− / +** để phóng thu và nút phần trăm để reset zoom.
- Giữ **Space** hoặc nút chuột giữa rồi kéo để pan. Cuộn trong panel chỉ cuộn nội dung panel.
- **Fit**: tự căn pan/zoom để toàn bộ sơ đồ vừa vùng canvas hiện tại, kể cả sau khi thay đổi độ rộng panel. Nút này không sắp xếp lại card.
- **Focus**: chọn một card rồi bấm Focus để xem card ở giữa với mức zoom dễ đọc. Nếu chọn relation, Focus căn hai đầu nối và đường quan hệ vào khung. Nút bị vô hiệu khi chưa chọn card/relation.
- Fit/Focus chỉ thay khung nhìn, giữ nguyên vị trí và nội dung card. Focus camera không lọc/ẩn các card khác.
- Kéo đường phân cách panel hoặc dùng nút mở rộng để thay kích thước vùng đọc.

### Ngôn ngữ và giao diện

Dùng **Tiếng Việt / English** trên toolbar để đổi ngôn ngữ. Nút **◐ Sáng/Tối** chuyển Light/Dark mode. Giao diện tối điều chỉnh màu hiển thị card và sơ đồ để dễ đọc; màu đã chọn trong JSON được bảo toàn. Theme và locale chỉ sống trong phiên, mặc định sáng và tiếng Việt khi reload, không đi vào file export.

### Lưu và mở lại

Bấm **Xuất dự án** để tải file JSON. Khi có bản nháp, chọn áp dụng rồi xuất hoặc chỉ xuất phần đã áp dụng. Để tiếp tục ở phiên khác, import file JSON đã lưu. Schema dữ liệu nằm tại [project.schema.json](assets/data/project.schema.json).

## Dữ liệu và quyền riêng tư

Không backend, tài khoản, auto-save, localStorage/IndexedDB hoặc upload project. **Reload/đóng tab làm mất dữ liệu phiên; hãy export file JSON để lưu.** Trạng thái đã kích hoạt export không xác nhận file đã được lưu thành công trên đĩa. Cảnh báo beforeunload phụ thuộc trình duyệt và không cung cấp recovery.

Markdown HTML được hiển thị như văn bản; Mermaid dùng strict mode và SVG sanitize, chặn cấu hình/style/callback/tài nguyên ngoài trong source trước render. Ảnh ngoài bị chặn mặc định. Nếu bạn bật tải ảnh, host ảnh có thể nhận request. Thư viện được bundle local, không runtime CDN hoặc analytics nội dung.

## Cấu trúc và công nghệ

```text
index.html          Entry ở gốc repository
assets/css/         Giao diện và theme
assets/js/          App, store/history, canvas, validation, nội dung, i18n
assets/data/        JSON Schema và các project ví dụ
assets/vendor/      Thư viện bundle local
scripts/            Dev server, build, lint và benchmark
tests/              Unit và Playwright E2E
planning/           Plan, checklist và evidence
AGENTS.md           Quy trình cho agents
```

HTML/CSS/JavaScript ES modules; Cytoscape render quan hệ; Ajv validate schema; Marked + DOMPurify render Markdown; Mermaid render sơ đồ. Dependency khóa trong package-lock.json. Không cần framework hoặc server ứng dụng để chạy sản phẩm.

## Hợp đồng và giới hạn 1.0.0

Phiên bản ứng dụng **1.0.0**; version trong JSON là **1.0**. Type là chuỗi tùy chọn; ID ổn định và relation tham chiếu ID card. Cho phép cycle và parallel relations; không self-loop. Unknown fields bị từ chối ngoài extensions có namespace. Vị trí thiếu được bổ sung theo grid với thông báo import.

Giới hạn: 10 MiB/file và canonical export, 500 cards, 2.000 relations, 100.000 ký tự Markdown/card. History: 100 transaction/20 MiB UTF-8 serialized patches; transaction vượt ngân sách được báo không thể undo.

Mobile hiện hiển thị thông báo dùng desktop. Multi-select, filter, Focus theo hướng/depth (lọc lân cận), minimap, auto-layout và References registry còn trong backlog.

## Kiểm tra

```sh
npm test
npm run check
npm run typecheck
npm run format:check
npm run e2e
npm run benchmark
```

E2E cần server local đang chạy. Chrome/Edge dùng browser cài trên máy; cài Firefox test nếu cần bằng npx playwright install firefox. Typecheck kiểm tra contract declarations; runtime JS được kiểm tra bằng schema, lint và browser tests. Kết quả thực tế nằm trong [implementation-evidence.md](planning/implementation-evidence.md).

## Deploy static

Chạy npm run build rồi phục vụ index.html và toàn bộ assets/ qua static hosting cùng origin. Không deploy node_modules, tests hoặc planning. Không thêm runtime CDN hoặc analytics project. Chưa publish hosting trong nhiệm vụ này.

## Theo dõi phát triển

Agents đọc [AGENTS.md](AGENTS.md), [plan](planning/implementation-plan.md) và [checklist CSV](planning/implementation-checklist.csv) trước khi sửa. Trạng thái DONE phải có kiểm chứng và evidence. Backlog V1.1/V2 chỉ được thực hiện khi người dùng giao tiếp.
