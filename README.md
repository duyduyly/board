# Card Atlas — Version 1.0.0

## Khung nhóm, đường nối và bộ mẫu học tập

Chọn ít nhất hai card chưa thuộc nhóm → **Tạo nhóm** để đặt tên khung. Kéo thanh tên để di chuyển nhóm; card ghim đứng yên. Sửa nhóm cho phép đổi tên/bỏ thành viên; rã nhóm giữ nguyên card. Phần sửa liên kết có kiểu đường cong, thẳng, vuông góc và zigzag. Node ảnh dùng summary trên Canvas, giữ title trong Detail; node chữ hiện title và summary.

Gallery → **Bộ mẫu đầy đủ** có 6 thiết kế học tập độc lập: kế hoạch ôn giãn cách, so sánh khái niệm, lời giải mẫu/tự luyện, Cornell, sơ đồ tự nhớ và nhật ký sửa lỗi. [JSON mẫu](assets/data/showcase-example.json) · [Hướng dẫn cho Agent](docs/showcase-reference.md) · [Nghiên cứu phương pháp học](docs/study-notes-research.md).

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
- Hai ví dụ: kiến trúc hệ thống và bài học **-s/-es, -ed** gồm 12 node, 11 nhánh và một liên kết tham khảo, 12 câu luyện tập có đáp án; hỗ trợ Mind Map với Root định sẵn.

## Chạy local

Yêu cầu Node.js hỗ trợ dependency trong package-lock.json; đã kiểm tra với Node **25.8.2**. Chrome/Edge/Firefox desktop là môi trường mục tiêu.

```sh
npm ci
npm run build
npm run dev
```

Mở **http://127.0.0.1:4173**. Nếu thư viện local đã được build, các lần chạy sau chỉ cần npm run dev. Không mở index.html bằng file://: ES modules, JSON và renderer cần static HTTP server. Server dev chỉ bind 127.0.0.1 và phục vụ file; không có API lưu project.

## Hướng dẫn sử dụng

Bấm nút **?** nhỏ ngay bên phải **Tiếng Việt / English** để xem hướng dẫn nhanh về chọn/kéo nhóm, quét chọn, ghim, đọc/sửa, điều hướng và lưu JSON. Dùng **Đóng** hoặc **Escape** để quay lại.

### ChatGPT bên cạnh Canvas

Nút **ChatGPT ↗** ở mép phải Canvas mở ChatGPT trong cửa sổ riêng. Bạn có thể kéo cửa sổ sang bên cạnh và dùng controls của hệ điều hành để đổi kích thước, thu nhỏ hoặc phóng to. Trình duyệt quyết định có mở thành cửa sổ hay tab. Nút **×** ẩn shortcut; bật lại tại **Menu dự án → Hiện nút ChatGPT bên phải**. Nếu popup bị chặn, dùng **Mở ChatGPT trong tab mới** trong cùng menu. Lựa chọn ẩn chỉ giữ trong phiên. Card Atlas không tự gửi nội dung dự án sang ChatGPT; tài khoản và hội thoại nằm trên trang ChatGPT riêng.

### Bắt đầu

Chọn **Bắt đầu trống**, **Mở ví dụ**, **Ví dụ tiếng Anh: -s/-es và -ed**, hoặc **Nhập project JSON** trên màn hình bắt đầu. Nút **Dự án mới** trên toolbar mở hộp thoại đặt tên; chọn **Tạo dự án** để tạo sơ đồ trống hoặc **Hủy** để giữ project hiện tại. Tên không được để trống. Nếu đang có dữ liệu chưa xuất, ứng dụng hỏi trước khi thay thế.

Nếu đang có project, dùng Nhập JSON để mở file khác; ứng dụng sẽ cảnh báo khi thay thế dữ liệu chưa export.

File bài học có thể tải/import riêng tại [english-endings-example.json](assets/data/english-endings-example.json). Giải thích bằng tiếng Việt với công thức và ví dụ tiếng Anh. Chuyển ngôn ngữ giao diện không dịch nội dung card.

### Card và quan hệ

1. Bấm **Thẻ mới** để tạo card. Click vùng trống card để chọn/kéo; bấm tiêu đề, tóm tắt hoặc loại để sửa trong popup riêng. Bấm **↗** để mở Detail; **Chỉnh sửa** tập trung nội dung Markdown, **Format** quản lý khung/màu nền/hình dạng; Tags nằm trong popup thông tin.
2. Chọn **Áp dụng** để lưu thay đổi vào project trong phiên, hoặc **Hủy** để bỏ bản nháp. Đổi theme giữ nguyên bản nháp.
3. Kéo card trên canvas để đổi vị trí.
4. Dùng **Kết nối**, chọn card nguồn rồi card đích; hoặc kéo chấm nối bên cạnh card. Thả vào vùng trống tạo card mới và quan hệ trong một thao tác undo.
5. Click đường nối để đọc/sửa relation. Xóa card sẽ xóa các relation liên quan.
6. Dùng Undo/Redo để quay lại hoặc thực hiện lại thao tác dữ liệu.

Badge phía trên hiển thị type; số quan hệ nằm trong tooltip của nút ↗. Dưới card có tối đa hai tag không trùng type; **+N** hiển thị các tag còn lại qua tooltip.

### Chọn nhiều khối và kéo nhóm

- **Shift + click** khối (kể cả chữ) để thêm/bỏ khỏi nhóm. Bằng bàn phím: focus khối rồi **Shift + Space**.
- **Shift + kéo vùng trống** để quét chọn thêm các khối giao với khung. Chỉ chọn khối đang hiển thị; quét theo hướng nào cũng được.
- Kéo vùng trống trên một khối chưa ghim đã chọn để dịch cả nhóm. **Khối đã ghim đứng yên**. Mỗi lần kéo là một bước Undo; chỉ vị trí trong view hiện tại thay đổi.
- **Escape** khi đang kéo hủy lần kéo; nhấn lại để bỏ chọn. Nút **Bỏ chọn** hoặc click vùng trống cũng xóa nhóm. Click khối ngoài nhóm thay selection; click khối trong nhóm giữ nhóm.
- Nhóm hiện chỉ dùng để kéo; chọn một khối để sửa/xóa. Mở Detail, sửa chữ/ngày, bật Kết nối hoặc chuyển Card/Mind đưa nhóm về một khối. Nhóm chọn chỉ tồn tại trong phiên, không lưu trong JSON.

### Điều hướng sơ đồ

- Cuộn chuột trên canvas để zoom; dùng **− / +** để phóng thu và nút phần trăm để reset zoom.
- Giữ **Space** hoặc nút chuột giữa rồi kéo để pan. Cuộn trong panel chỉ cuộn nội dung panel.
- **Fit**: tự căn pan/zoom để toàn bộ sơ đồ vừa vùng canvas hiện tại, theo kích thước viewport hiện tại. Nút này không sắp xếp lại card.
- **Focus**: chọn một card rồi bấm Focus để xem card ở giữa với mức zoom dễ đọc. Nếu chọn relation, Focus căn hai đầu nối và đường quan hệ vào khung. Nút bị vô hiệu khi chưa chọn card/relation.
- Fit/Focus chỉ thay khung nhìn, giữ nguyên vị trí và nội dung card. Focus camera không lọc/ẩn các card khác.
- Detail mở giữa màn hình; dùng nút Full để đọc toàn màn hình. Đóng Detail trước khi kéo hoặc nối card trên Canvas.

### Ngôn ngữ và giao diện

Chỉ có một bộ chọn **Tiếng Việt / English** trên toolbar chính, áp dụng cho toàn bộ web và mọi popup/tab. Chọn ngôn ngữ trước khi mở popup; popup không có bộ chọn riêng. Nút **◐ Sáng/Tối** chuyển Light/Dark mode. Giao diện tối điều chỉnh màu hiển thị card và sơ đồ để dễ đọc; màu đã chọn trong JSON được bảo toàn. Theme và locale chỉ sống trong phiên, mặc định sáng và tiếng Việt khi reload, không đi vào file export.

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

Trong tab **Chỉnh sửa**, chọn **Viết tập trung** để mở vùng viết rộng. Thông tin card có thể thu gọn; **Về sơ đồ** quay lại Canvas. Đổi theme giữ vị trí con trỏ, selection và cuộn trong ô viết. **Xem trước bản nháp** render Markdown/Mermaid/ảnh mà chưa thay project; **Viết Markdown** quay lại soạn thảo. Apply/Cancel vẫn quản lý bản nháp; nút Apply ở vùng thao tác cố định khi cuộn.

Mẫu Hướng dẫn/API/Ghi chú được chèn **thêm ở cuối** nội dung, không thay phần đang viết. Mục lục tự tạo khi bài có từ hai heading H1–H3, bấm để đi tới mục tương ứng. Tìm kiếm toàn văn chạy trên nội dung đã Apply; chưa tìm bản nháp và chỉ highlight trong đoạn trích kết quả.

**Tải Markdown** tải nội dung card đang viết, gồm bản nháp và ảnh nhúng chuyển thành data URI. Một số trình đọc Markdown không hỗ trợ data URI hoặc Mermaid; xuất JSON vẫn là cách giữ đầy đủ graph/relations/vị trí. Markdown xuất quá lớn do lặp ảnh sẽ bị chặn ở khoảng 10 MiB.

## Khôi phục cục bộ tùy chọn

Ở sidebar, chọn **Khôi phục cục bộ** → đọc thông tin → **Bật khôi phục cục bộ**. Sau khoảng 500 ms không có thay đổi, ứng dụng lưu project, viewport, selection và bản nháp; có trạng thái xác nhận hoặc báo lỗi. Reload mở lựa chọn khôi phục, không tự thay project. Có thể tiếp tục phiên hiện tại để thay bản khôi phục cũ; Hủy giữ bản cũ và tạm dừng ghi đè cho đến khi bạn chọn. **Tắt và xóa bản khôi phục** xóa dữ liệu lưu cục bộ.

Bản khôi phục chỉ nằm trong cùng origin/hồ sơ trình duyệt trên máy này, không mã hóa và không upload; người dùng cùng hồ sơ có thể truy cập. Trình duyệt có thể xóa dữ liệu hoặc từ chối lưu. Chỉ lưu bản gần nhất, giới hạn 20 MiB gồm project và draft; không khôi phục undo/redo. Thay đổi trong khoảng debounce cuối trước khi tab bị đóng đột ngột có thể chưa được ghi. Khi báo lỗi lưu, hãy Apply và export JSON.

Xuất JSON chỉ xác nhận yêu cầu download đã được gửi; hãy kiểm tra file trong Downloads trước khi đóng tab.

## Detail: Format và hình dạng card

Chọn card → tab **Format** để chỉnh chiều rộng/cao, nền, màu viền, bo góc (0–100px), độ dày viền (0–8px), căn trái/giữa/phải và bóng nhẹ/không bóng. Chọn **Góc vuông** hoặc **Bo tròn** ngay trong danh sách hình dạng; **Đặt lại khung card** giữ font cũ và style chữ riêng. Khung xem trước phản ánh bản nháp; **Áp dụng** cập nhật card và relations trên Canvas, **Hủy** khôi phục dữ liệu đã Apply. Undo/Redo phục hồi thay đổi nguyên khối. Đặt lại hình dạng không xóa nội dung, kích thước hoặc màu đã chọn.

Tab **Chỉnh sửa** và **Format** chia sẻ cùng bản nháp; đổi giữa hai tab không cần Apply, chuyển sang Tổng quan/card khác vẫn hỏi khi có thay đổi. Kích thước lưu trong size, các thuộc tính hình dạng lưu dưới extensions.card-atlas:appearance, giữ JSON version1.0. Dark mode điều chỉnh màu card để dễ đọc như trước; Light mode hiển thị màu đã chọn trực tiếp. Kích thước quá nhỏ có thể che overview; hãy tăng kích thước nếu title/tags bị cắt.

Trong tab **Chỉnh sửa**, chọn đoạn chữ trong ô Markdown rồi dùng **B**, **I**, **Code** hoặc chọn màu và bấm **Tô màu chữ đã chọn**. Màu dùng cú pháp: `[Nội dung nổi bật]{color:#d34f45}`. Dùng **Xem trước bản nháp** để kiểm tra trước Apply. Cú pháp màu áp dụng cho đoạn text một dòng; có thể bọc bên ngoài bằng Markdown đậm/nghiêng: `**[Nội dung]{color:#d34f45}**`. Nội dung HTML tùy ý vẫn được hiển thị như text; chỉ màu hex6 được nhận, không nhận CSS tùy ý. Cú pháp màu là phần mở rộng của Card Atlas; trình đọc Markdown khác có thể hiển thị nguyên cú pháp.

## Illustrated Mind Map — đợt 1

Chọn Card Map / Mind Map trên toolbar. Hai view dùng chung nội dung và Detail, có vị trí/kích thước riêng. Mind Map cho phép kéo node thủ công và sắp xếp radial có Preview/Apply/Cancel, thu gọn nhánh; dùng Fit/Focus để đọc từng vùng.

Trong Detail → Format chọn Card, Chữ, Ảnh hoặc Ảnh và chữ. Thêm ảnh PNG/JPEG/WebP/GIF ở Edit rồi chọn làm ảnh đại diện; ảnh nhúng nằm trong JSON, không tải lên server. Contain hiển thị toàn bộ ảnh; Cover lấp đầy khung. Đổi cover hoặc kiểu node trước khi xóa attachment đang dùng. Click chữ mở popup thông tin; nút ↗ hoặc Enter khi focus node mở Overview; connector vẫn tạo liên kết như card.

Đặt Root trong Format; chỉnh relation → Vai trò Mind Map → Nhánh cha → con hoặc Liên kết tham khảo. Branch không cycle và mỗi node tối đa một parent. Đổi Root có parent yêu cầu xác nhận chuyển liên kết đi vào sang tham khảo. Node ngoài Root có viền đứt và nhãn riêng. Màu Mind Map không thay màu liên kết Card Map.

Ví dụ: [assets/data/mind-map-example.json](assets/data/mind-map-example.json), mở bằng nút Ví dụ Mind Map. UI hỗ trợ Tiếng Việt/English, light/dark. Export lưu graph và geometry cả hai view; chuyển view không tự sắp xếp hay thêm undo. Recovery vẫn opt-in và giữ draft/view khi bật.

Illustrated Mind Map phase 1: choose a view in the toolbar, select a node style/cover in Detail Format, and assign Root plus Branch/Reference roles. Both views share content with separate geometry. Manual dragging, radial layout preview and branch collapse are available. Use Edit to embed raster images, then select their cover in Format. Export JSON to preserve your work.

## Bố trí radial và thu gọn nhánh — đợt 2

Trong Mind Map, đặt Root rồi bấm **Sắp xếp Mind Map**. Preview hiển thị toàn bộ graph; các node ngoài Root nằm ở vùng riêng. Bố trí xét kích thước thực, chỉ dựa vào branch; liên kết tham khảo không đổi hierarchy. **Áp dụng bố trí** lưu vị trí Mind Map trong một undo và giữ Card Map nguyên vẹn. **Hủy**, Escape hoặc đổi view bỏ preview và khôi phục viewport/trạng thái nhánh trước preview. **Đặt lại preview** tính lại từ model hiện tại. Trong preview, chỉnh sửa và export tạm khóa; theme/zoom/Fit vẫn dùng được. Áp dụng lại bố trí không đổi không thêm history.

Nút − bên trái node có con thu gọn descendants; nút +N mở lại và cho biết số node ẩn. **Mở tất cả nhánh** bỏ trạng thái thu gọn. Chỉ branch quyết định descendants; liên kết tham khảo với đầu bị ẩn cũng ẩn. Search, điều hướng và Focus mở các tổ tiên cần thiết. Nếu thu gọn làm selection bị ẩn, Detail chuyển về node cha sau guard draft.

Thu gọn thuộc phiên: không làm dirty/undo, không export hay recovery; export luôn đủ node/relation/ảnh. Layout đã Apply lưu trong JSON và recovery như geometry khác. Graph lớn hoặc node quá lớn có cảnh báo trải rộng; dùng zoom/Focus và chỉnh thủ công. Không cam kết đường cong tránh mọi node.

English: set Root, then Arrange Mind Map to preview. Apply writes only Mind Map positions in one undo step; Cancel/Escape/view switch restores the earlier view. Collapse uses branch descendants and remains session-only. Search/Focus reveals ancestors; export retains the complete graph. Large maps may need zoom, Focus and manual adjustments.

Với ≥1.000 đường nối, pan/zoom/drag tạm ẩn đường nối và khôi phục sau khi dừng khoảng 160 ms để giữ thao tác mượt. Khi zoom nhỏ, nhãn đường nối quá nhỏ được ẩn; zoom vào để đọc. / With ≥1,000 edges, movement temporarily defers edge rendering and restores it after about 160 ms idle; unreadably small edge labels are hidden until zoomed in.

## Màu trong suốt / Transparent colors

Chọn node → Edit hoặc Format → bật **Nền trong suốt** hoặc **Viền trong suốt** → Apply. Preview hiển thị ngay; bỏ chọn phục hồi màu đã chọn trước đó. Nền trong suốt không có shadow; node đang chọn vẫn có đường bao để nhận biết. Hỗ trợ Card Map/Mind Map và Light/Dark; các tùy chọn lưu trong JSON, Undo/Redo và recovery như appearance khác. Màu chữ vẫn giữ rõ để đọc.

Select a node → Edit or Format → check **Transparent background** / **Transparent border** → Apply. Uncheck to restore the saved color. Transparent backgrounds have no shadow; selected nodes retain a selection outline. Options survive JSON export/import and undo/redo.

## Cấu trúc và phát triển

[Hướng dẫn mở rộng source](docs/development.md) mô tả boundaries, commands, query cache và cách thêm feature. Common primitives nằm trong assets/js/common; UI services trong assets/js/ui; Detail field builder trong assets/js/detail. CSS chia base/theme/workspace và giữ cascade trong app.css. npm run check kiểm tra import cycles/layer boundaries/unused code; npm run typecheck kiểm tra contract và các module JavaScript thuần đã có JSDoc.

## Feedback 01 — đợt 1

Home mới là thư viện sáu template local, lọc Cá nhân/Học tập/Công việc/Dự án. Click tile mở bản project độc lập; logo đưa về Home, nút Tiếp tục giữ project trong phiên. Gallery không phải nơi tự lưu project.

Click vùng trống chọn node; double click vùng trống, nút Open hoặc Enter trên node mở Detail ở giữa. Click title/summary/type mở popup chỉnh thông tin. Detail có Tổng quan/Chỉnh sửa/Format, cỡ75% và Full. X, Escape hoặc click nền dùng guard khi có draft. Menu “Thao tác dự án” trong Detail giữ undo/redo, export, recovery, Guide, view và Fit/Focus. Đóng Detail vẫn giữ selection.

Ảnh Detail giữ vừa vùng đọc; click/Enter/Space để phóng ảnh. Viewer mặc định Fit trong75% viewport; chọn100% để xem kích thước gốc có cuộn. Escape đóng ảnh trước, rồi mới đóng Detail. Hover không tự phóng.

Gallery responsive; editor vẫn yêu cầu desktop. Không đổi JSON1.0, không tự lưu hoặc upload. Import Markdown/node JSON đã có trong đợt 2 bên dưới; sidebar hình dạng đã có ở đợt3. Plan: planning/feedback-01-plan.md; checklist: planning/feedback-01-checklist.csv.

## Feedback 01 — đợt 2: tài liệu và node offline

Trong Detail mở **Tài liệu & node**:

- **Nhập Markdown**: chọn .md UTF-8, xem preview, chọn Thay nội dung/Nối vào cuối. Chỉ đổi draft content; Apply để lưu, Cancel để bỏ. Metadata/relations/format giữ nguyên. Giới hạn content100.000 ký tự và project10MiB. Đường dẫn ảnh relative được liệt kê để chèn từ máy; không đọc/fetch ngầm. Data URI raster PNG/JPEG/WebP/GIF trong .md được chuyển thành attachment sau validation/decode, kể cả file Markdown do app export.
- **Xuất node JSON**: mặc định bản đã Apply; có thể chọn draft rõ ràng mà không Apply. File là projectJSON1.0 đúng một card, không có relation. Mặc định kèm mọi attachment; bỏ chọn để chỉ kèm ảnh content/cover. Extension card giữ nguyên; projectRoot/views lọc theo node. Unknown project extensions chỉ loại bỏ sau khi xác nhận; export không đánh dấu toàn project đã lưu.
- **Nhập node JSON**: preview rồi Update hiện tại hoặc Add mới. Update đưa metadata/content/ảnh vào draft, mặc định giữ ID/relations/position/style/kind/size. Lấy format là tùy chọn, size chỉ active view. Apply/Undo atomic. Add tạo ID mới ở giữa viewport, không tự Root/branch; guard draft trước commit, một Undo bỏ cả node.

Ảnh incoming trùng ID khác record được remap deterministic, giữ cover cũ khi không lấy format. Unknown card extension absent giữ nguyên; xung đột mặc định giữ existing, có lựa chọn thay bằng incoming. Unknown namespace có thể chứa reference riêng mà app không hiểu: không tự remap nội dung của chúng; kiểm tra trước khi dùng Add. Unknown project namespace bị loại trừ có xác nhận. File nhiều card/có relation phải dùng Import Project, không Import Node. Sai UTF8/JSON/dangling image/size không thay dữ liệu đang mở. ZIP ảnh rời, crop ảnh và shapes mới chưa thuộc đợt2.

Ví dụ: [node-transfer-example.json](assets/data/node-transfer-example.json); Format Guide có nút tải cùng hướng dẫn. Evidence: [feedback-01-phase2-evidence.md](planning/feedback-01-phase2-evidence.md).

## Feedback01 — đợt3: shapes, palette và kích thước

Sidebar có Card/Chữ/Ảnh/Ảnh+chữ và 8 shapes: chữ nhật, bo tròn, vuông, tròn, elip, thoi, tam giác đều và lục giác. Bấm hoặc Enter tạo ở giữa viewport; kéo thả để chọn vị trí. Ảnh yêu cầu chọn file PNG/JPEG/WebP/GIF; cancel không tạo node rỗng. Shape là presentation, không đổi type/kind. Tìm node/fulltext qua **Tìm node** hoặc Ctrl/Cmd+F; Guide, recovery và trạng thái/counts trong menu ☰.

Chọn node rồi kéo **handle vuông góc dưới phải** để resize (handle tròn là nối relation). Escape/blur/cancel hủy preview; thả chuột tạo một Undo. Resize chỉ view đang mở, giới hạn96×64–1200×1000; hình vuông/tròn/tam giác giữ tỷ lệ. Hình cố định tỷ lệ nằm trong bounds cũ khi import/đổi view, không tự sửa geometry view còn lại.

Detail → **Format**: chọn shape và Thủ công/Tự vừa nội dung; font8–72 chỉnh trong popup thông tin. Fit đo tổng quan (title, tối đa3 dòng summary, tags/cover tùy kind), không đo Markdown. Hình gọn chỉ title/cover trên Canvas; dữ liệu khác giữ Detail. Fit được tính trong draft và Apply atomic; Edit tiếp nội dung với modeFit sẽ đo lại tạiApply. Nội dung vượt khung tối đa được báo lỗi; rút gọn title hoặc giảm font. Locale/theme/render không tự resize. Camera Fit vẫn chỉ thay góc nhìn. Radius áp dụng shape rounded và card legacy; polygon có góc theo hình học. Fit ảnh thuần dùng khung240×180 trước khi giữ tỷ lệ shape.

Ví dụ: [basic-shapes-example.json](assets/data/basic-shapes-example.json), tải từ Format Guide rồi Import Project. Shape/font/sizeMode lưu trong card-atlas:appearance; JSON1.0, unknown extensions và ảnh portable giữ nguyên. Star/heart/octagon/arrow/các biến thể tam giác thuộc đợt4 FB024–FB029, chưa triển khai.

### Extended shapes (Feedback01 đợt4)

Format và palette hỗ trợ14hình: rectangle/rounded/square/circle/ellipse/diamond/triangle/hexagon/star/heart/octagon/arrow/isosceles-triangle/right-triangle. triangle là tam giác đều; ellipse gồm oval. Shapes compact giữ title/cover, nội dung đầy đủ trong Detail.

Format Guide → Mixed shapes example → Import để thử ảnh/text và cả hai view. Chọn node → Enter → Format → font → Fit text → Apply; Undo khôi phục font/size cùng lúc. Resize dùng handle vuông, connector dùng handle tròn; Escape hủy resize. Manual có thể cắt title; Fit vượt bounds sẽ cảnh báo và giữ draft, hãy rút ngắn overview hoặc giảm font. Camera Fit chỉ thay viewport.

### Ghim và ngày tạo card

Nhấn icon ghim ở đầu node để **khóa chỉ xem** (mọi loại card/chữ/ảnh và cả hai view). Node đã ghim không thể kéo, đổi kích thước, sửa nội dung/ngày/style/ảnh, nhân bản hoặc xóa; quan hệ liên quan cũng được bảo vệ. Bạn vẫn có thể xem nội dung, mở ảnh, tìm kiếm và pan/zoom. Nhấn ghim lần nữa hoặc **Bỏ ghim card** trong Detail để chỉnh sửa trở lại; có Undo/Redo. Đồng nhất style bỏ qua node ghim; tự bố trí giữ vị trí node ghim và có thể báo chồng lấn thay vì tự dời chúng. Các node `pinned: true` trong JSON cũ cũng được khóa. Ngày tạo nằm ở góc đầu card, lưu UTC trong extensions.card-atlas:metadata.createdAt và giữ nguyên khi sửa. Card cũ không có dữ liệu ngày hiển thị chưa có ngày tạo; không gán ngày giả. Card mới/nhân bản có ngày mới, import giữ ngày nguồn. Pin và ngày đi cùng JSON project/node offline.

Giao diện giấy note theo reference .agents/idea/note-paper.png: bóng nhẹ, ghim đỏ, badge ngày góc trái. Màu nền tùy chỉnh được giữ; node hình khác giữ outline. Mẫu5màu: assets/data/note-paper-example.json (Import JSON). Không dùng ảnh watermark làm tài nguyên.

### Nhập ngày trên Canvas

Bấm badge ngày ở góc trên trái card để mở ô nhập/chọn ngày. Chọn **Áp dụng** để lưu hoặc **Hủy/Escape** để bỏ thay đổi. Xóa ngày nhập để trở lại ngày tạo tự động (card cũ chưa có timestamp sẽ hiển thị chưa có ngày). Ngày nhập lưu trong `card-atlas:metadata.createdDate` theo `YYYY-MM-DD`, giữ nguyên `createdAt` gốc và hỗ trợ Undo/Redo ở cả Card Map và Mind Map.

Tài liệu nội bộ trong planning/, project-context/ và wordspace/ được giữ local, không nằm trong bản clone GitHub. Khi làm việc với agents trên máy khác, sao chép riêng các folder này để có plan/checklist/spec. scripts/vendor-src/ được tạo lại khi chạy npm run build; assets/vendor/ vẫn nằm trong repo để ứng dụng chạy offline.

### Sửa thông tin ngay trên card

Bấm tiêu đề, tóm tắt hoặc type badge (Enter/Space khi focus) để mở popup. Chọn mục cần sửa để thêm cả tóm tắt/loại đang trống. Mỗi mục có cỡ chữ8–72px, màu và font System/Serif/Monospace; không tải font từ mạng. Ô cỡ chữ trống/font Mặc định kế thừa style cũ; Đặt lại định dạng chỉ xóa override của mục đang chọn. Apply lưu chung một Undo, Hủy/Escape bỏ staging. Di chuyển card bằng vùng trống quanh chữ.

Detail → Chỉnh sửa dành cho Markdown; nút Chỉnh thông tin card mở cùng popup nhưng cập nhật bản nháp, chỉ commit khi Apply Detail. Tags nằm trong popup thông tin; màu nền/viền nằm Format. JSON1.0 lưu override trong card-atlas:typography theo title/summary/type; không có override thì giao diện giữ nguyên. titleFontSize cũ trong JSON vẫn được đọc; giao diện chỉ chỉnh cỡ chữ qua popup thông tin. Nội dung Markdown không đổi font theo style overview.

### Đồng nhất style các card

Trong popup Chỉnh thông tin card, bật **Đồng nhất style tất cả card** rồi Áp dụng. Bộ cỡ chữ/màu/font của tiêu đề, tóm tắt và loại sẽ được áp dụng tương ứng cho mọi card hiện có; chữ và Markdown của các card khác giữ nguyên. Một Undo khôi phục toàn bộ. Trong Detail, thay đổi chờ Apply Detail và có thể Hủy bản nháp. Đây là thao tác áp dụng hiện tại, không tự áp dụng cho card tạo sau. Card Fit được tính lại ở view đang mở; nếu có card không vừa hoặc vượt giới hạn dữ liệu thì không áp dụng một phần.

### Format và Chỉnh sửa sau nâng cấp UX

**Chỉnh sửa** tập trung Markdown; ảnh/tệp đính kèm thu gọn khi trống. **Chỉnh thông tin card** quản lý title/summary/type/tags và cỡ/màu/font từng mục. Popup mở từ Detail dùng nút **Cập nhật bản nháp**; bấm Áp dụng trong Detail để lưu.

**Format** chia nhóm Kiểu hiển thị, Kích thước, Nền/khung và preview sticky cạnh bên. Chỉ hiện ảnh khi kiểu ảnh hoặc còn cover được lưu; công cụ Root chỉ ở Mind Map; bo góc chỉ ở hình có dùng corner. Chọn một chế độ Thủ công/Tự vừa nội dung; sửa rộng/cao chuyển về thủ công. Fit trên toolbar vẫn chỉ camera. Màu chữ mặc định cũ nằm Nâng cao và chỉ tác động phần chưa override/tags. Dropdown Góc vuông đặt radius0, Bo tròn đặt24 khi chọn; không thay JSON đã import ngầm.

Chuyển tab về đầu để không khuất toolbar; đổi theme trong cùng tab giữ bản nháp, caret, scroll và nhóm nâng cao đang mở. Preview và nút reset khung không thay nội dung/style chữ. Undo/Redo và JSON1.0 giữ nguyên.
