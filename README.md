# Card Atlas — Version 1.0.0

**Phiên bản hiện tại: 1.0.0.** Card Atlas là trình biên tập đồ thị trực quan chạy phía trình duyệt, dùng JSON để lưu các card và quan hệ. Bạn có thể xây bản đồ kiến thức, ghi chú học tập, luồng công việc hoặc tài liệu kiến trúc hệ thống. Giao diện hỗ trợ **Tiếng Việt / English**, **Light / Dark mode**.

## Tính năng

- Tạo, chỉnh sửa, kéo thả, nhân bản và xóa card; nối card bằng quan hệ có nhãn, màu và hướng mũi tên.
- Card có badge loại, nút ↗ mở Detail và tag nhẹ. Title tối đa 2 dòng, summary tối đa 3 dòng; số quan hệ nằm trong tooltip của nút mở.
- Panel đọc Markdown, bảng, ảnh nhúng và sơ đồ Mermaid; editor có Apply/Cancel để quản lý bản nháp.
- Chèn ảnh từ máy và lưu dữ liệu ảnh trong JSON; export/import một file vẫn hiển thị ảnh ở Detail.
- Undo/Redo cho các thao tác dữ liệu; xóa card và các quan hệ được phục hồi cùng nhau.
- Tìm theo title, summary, type, tags và nội dung Markdown; kết quả có đoạn trích và highlight.
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

Chọn **Bắt đầu trống**, **Mở ví dụ**, **Ví dụ tiếng Anh: -s/-es và -ed**, hoặc **Nhập project JSON** trên màn hình bắt đầu. Nút **Dự án mới** trên toolbar mở hộp thoại đặt tên; chọn **Tạo dự án** để tạo sơ đồ trống hoặc **Hủy** để giữ project hiện tại. Tên không được để trống. Nếu đang có dữ liệu chưa xuất, ứng dụng hỏi trước khi thay thế.

Nếu đang có project, dùng Nhập JSON để mở file khác; ứng dụng sẽ cảnh báo khi thay thế dữ liệu chưa export.

File bài học có thể tải/import riêng tại [english-endings-example.json](assets/data/english-endings-example.json). Giải thích bằng tiếng Việt với công thức và ví dụ tiếng Anh. Chuyển ngôn ngữ giao diện không dịch nội dung card.

### Card và quan hệ

1. Bấm **Thẻ mới** để tạo card. Click card để đọc; double click hoặc bấm **↗** để mở Tổng quan trong Detail. Chọn **Chỉnh sửa** để sửa title, summary, type, tags, màu và nội dung.
2. Chọn **Áp dụng** để lưu thay đổi vào project trong phiên, hoặc **Hủy** để bỏ bản nháp. Đổi ngôn ngữ/theme giữ nguyên bản nháp.
3. Kéo card trên canvas để đổi vị trí.
4. Dùng **Kết nối**, chọn card nguồn rồi card đích; hoặc kéo chấm nối bên cạnh card. Thả vào vùng trống tạo card mới và quan hệ trong một thao tác undo.
5. Click đường nối để đọc/sửa relation. Xóa card sẽ xóa các relation liên quan.
6. Dùng Undo/Redo để quay lại hoặc thực hiện lại thao tác dữ liệu.

Badge phía trên hiển thị type; số quan hệ nằm trong tooltip của nút ↗. Dưới card có tối đa hai tag không trùng type; **+N** hiển thị các tag còn lại qua tooltip.

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

## Chèn ảnh và lưu cùng JSON

1. Chọn card → **Chỉnh sửa**.
2. Bấm **Chèn ảnh từ máy** và chọn PNG, JPEG, WebP hoặc GIF.
3. Ứng dụng đưa ảnh vào bản nháp và chèn dòng Markdown tại vị trí con trỏ.
4. Bấm **Áp dụng**, rồi chọn **Tổng quan** để xem ảnh ở Detail.
5. **Xuất dự án** để lưu JSON. Import JSON này trên máy khác vẫn thấy ảnh; không cần file ảnh rời hoặc URL website.

Ảnh được mã hóa Base64 và lưu trong extensions của card dưới namespace **card-atlas:images**, cùng tên file và mimeType. Nội dung Markdown tham chiếu bằng dạng **![Mô tả](attachment:image-ID)**; ứng dụng tự tạo ID và dữ liệu khi upload. Base64 làm file lớn hơn khoảng 33%; toàn bộ JSON vẫn giới hạn 10 MiB.

Ảnh nhúng hiển thị tự động, không cần nút cho phép tải ảnh ngoài và không gửi request ngoài. Ảnh URL qua Markdown vẫn được hỗ trợ nhưng phải bật tải ảnh ngoài. SVG và ảnh hỏng không được chèn. **Hủy** bỏ ảnh chưa áp dụng; **Xóa ảnh** trong editor gỡ file nhúng và tham chiếu do ứng dụng tạo. Nếu bạn đã tự sửa caption/link, hãy xóa dòng tham chiếu đó khỏi Markdown khi gỡ ảnh. Undo/Redo phục hồi thao tác áp dụng/xóa ảnh.

Ví dụ tiếng Anh đã có một ảnh minh họa được lưu ngay trong JSON; mở card **Đuôi -s/-es và -ed** để xem.

## Dữ liệu và quyền riêng tư

Không backend, tài khoản hoặc upload project. Mặc định không lưu project trong trình duyệt. Bạn có thể chủ động bật **Khôi phục cục bộ** để lưu project và bản nháp trong IndexedDB; một marker opt-in được lưu trong localStorage. **Nếu chưa bật khôi phục cục bộ, reload/đóng tab làm mất dữ liệu phiên; hãy export file JSON để lưu.** Trạng thái đã kích hoạt export không xác nhận file đã được lưu thành công trên đĩa. Cảnh báo beforeunload phụ thuộc trình duyệt. Khôi phục cục bộ chỉ hoạt động khi được bật và không thay bản sao JSON.

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

### Xem ảnh ở kích thước gốc

Hover ảnh trong Detail để mở preview **100% kích thước gốc** (1 pixel ảnh tương ứng 1 CSS pixel). Ảnh lớn hơn màn hình giữ nguyên kích thước và có thể cuộn ngang/dọc trong preview. Di chuột vào preview để xem, di ra ngoài để đóng; có thể dùng nút × hoặc Escape. Dùng Tab để focus ảnh cũng mở preview. Hỗ trợ ảnh nhúng trong JSON và ảnh URL được người dùng cho phép.

Card mới mặc định 260 × 190 px để đủ chỗ cho overview; kích thước riêng trong JSON đã có vẫn được giữ nguyên.

## Viết tài liệu

Trong tab **Chỉnh sửa**, chọn **Viết tập trung** để mở vùng viết rộng. Thông tin card có thể thu gọn; **Về sơ đồ** quay lại Canvas. Đổi theme/ngôn ngữ giữ vị trí con trỏ, selection và cuộn trong ô viết. **Xem trước bản nháp** render Markdown/Mermaid/ảnh mà chưa thay project; **Viết Markdown** quay lại soạn thảo. Apply/Cancel vẫn quản lý bản nháp; nút Apply ở vùng thao tác cố định khi cuộn.

Mẫu Hướng dẫn/API/Ghi chú được chèn **thêm ở cuối** nội dung, không thay phần đang viết. Mục lục tự tạo khi bài có từ hai heading H1–H3, bấm để đi tới mục tương ứng. Tìm kiếm toàn văn chạy trên nội dung đã Apply; chưa tìm bản nháp và chỉ highlight trong đoạn trích kết quả.

**Tải Markdown** tải nội dung card đang viết, gồm bản nháp và ảnh nhúng chuyển thành data URI. Một số trình đọc Markdown không hỗ trợ data URI hoặc Mermaid; xuất JSON vẫn là cách giữ đầy đủ graph/relations/vị trí. Markdown xuất quá lớn do lặp ảnh sẽ bị chặn ở khoảng 10 MiB.

## Khôi phục cục bộ tùy chọn

Ở sidebar, chọn **Khôi phục cục bộ** → đọc thông tin → **Bật khôi phục cục bộ**. Sau khoảng 500 ms không có thay đổi, ứng dụng lưu project, viewport, selection và bản nháp; có trạng thái xác nhận hoặc báo lỗi. Reload mở lựa chọn khôi phục, không tự thay project. Có thể tiếp tục phiên hiện tại để thay bản khôi phục cũ; Hủy giữ bản cũ và tạm dừng ghi đè cho đến khi bạn chọn. **Tắt và xóa bản khôi phục** xóa dữ liệu lưu cục bộ.

Bản khôi phục chỉ nằm trong cùng origin/hồ sơ trình duyệt trên máy này, không mã hóa và không upload; người dùng cùng hồ sơ có thể truy cập. Trình duyệt có thể xóa dữ liệu hoặc từ chối lưu. Chỉ lưu bản gần nhất, giới hạn 20 MiB gồm project và draft; không khôi phục undo/redo. Thay đổi trong khoảng debounce cuối trước khi tab bị đóng đột ngột có thể chưa được ghi. Khi báo lỗi lưu, hãy Apply và export JSON.

Xuất JSON chỉ xác nhận yêu cầu download đã được gửi; hãy kiểm tra file trong Downloads trước khi đóng tab.

## Detail: Format và hình dạng card

Chọn card → tab **Format** để chỉnh chiều rộng/cao, nền, màu chữ, màu viền, bo góc (0–100px), độ dày viền (0–8px), cỡ chữ tiêu đề (12–24px), căn trái/giữa/phải và bóng nhẹ/không bóng. Có preset **Góc vuông**, **Bo tròn** và **Đặt lại hình dạng**. Khung xem trước phản ánh bản nháp; **Áp dụng** cập nhật card và relations trên Canvas, **Hủy** khôi phục dữ liệu đã Apply. Undo/Redo phục hồi thay đổi nguyên khối. Đặt lại hình dạng không xóa nội dung, kích thước hoặc màu đã chọn.

Tab **Chỉnh sửa** và **Format** chia sẻ cùng bản nháp; đổi giữa hai tab không cần Apply, chuyển sang Tổng quan/card khác vẫn hỏi khi có thay đổi. Kích thước lưu trong size, các thuộc tính hình dạng lưu dưới extensions.card-atlas:appearance, giữ JSON version1.0. Dark mode điều chỉnh màu card để dễ đọc như trước; Light mode hiển thị màu đã chọn trực tiếp. Kích thước quá nhỏ có thể che overview; hãy tăng kích thước nếu title/tags bị cắt.

Trong tab **Chỉnh sửa**, chọn đoạn chữ trong ô Markdown rồi dùng **B**, **I**, **Code** hoặc chọn màu và bấm **Tô màu chữ đã chọn**. Màu dùng cú pháp: `[Nội dung nổi bật]{color:#d34f45}`. Dùng **Xem trước bản nháp** để kiểm tra trước Apply. Cú pháp màu áp dụng cho đoạn text một dòng; có thể bọc bên ngoài bằng Markdown đậm/nghiêng: `**[Nội dung]{color:#d34f45}**`. Nội dung HTML tùy ý vẫn được hiển thị như text; chỉ màu hex6 được nhận, không nhận CSS tùy ý. Cú pháp màu là phần mở rộng của Card Atlas; trình đọc Markdown khác có thể hiển thị nguyên cú pháp.
