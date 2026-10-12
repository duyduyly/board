# Kế hoạch Illustrated Mind Map và node ảnh

Ngày: 2026-10-12. Trạng thái: đợt 1 đã triển khai và nghiệm thu; đợt 2 chưa thực hiện.

Nguồn yêu cầu: thêm một kiểu map trong cùng project; Card Map nối được card với ảnh độc lập; Illustrated Mind Map thể hiện text/image/image + text và mở Detail hiện có khi click. Card View tiếp tục được hỗ trợ.

Checklist chính: [implementation-checklist.csv](implementation-checklist.csv), các task MM001–MM020. Bản trích riêng: [mind-map-checklist.csv](mind-map-checklist.csv). Checklist chính là nguồn trạng thái; khi cập nhật các task MM, tạo lại bản trích để tránh lệch. Không reset các task DONE hoặc tự triển khai BACKLOG khác.

## 1. Mục tiêu và phạm vi

Hai chế độ Canvas trong cùng project: **Card Map** và **Illustrated Mind Map**. Dùng chung ID node, nội dung, attachments và relations; chỉ khác cách trình bày và bố trí. Giữ root index.html, CSS/JS/data trong assets/, UI Việt/Anh, light/dark, project local, JSON import/export và recovery opt-in hiện có.

Card Map có card thông thường và node ảnh độc lập; ảnh có Detail, Format, tags, Markdown/Mermaid, selection, drag, resize qua Format, connector và Undo/Redo như card. Có thể nối card → ảnh, ảnh → ảnh hoặc ảnh → card. Đây là node thật, không chỉ là hình minh họa trong Markdown của card khác.

Mind Map dùng overview tối giản: text; image; image + text. Node trung tâm là Root, nhánh có đường cong và màu theo nhóm. Click text/image hoặc dùng bàn phím mở Detail Overview. Nội dung dài, bảng, code và Mermaid vẫn ở Detail. Ảnh nhúng trong Detail tiếp tục hoạt động riêng với ảnh đại diện trên Canvas.

Không thêm backend/cloud/account/upload, editor mobile, AI sinh nội dung, minimap, freehand drawing, quản lý nhiều bản đồ độc lập hoặc saved-view presets. Một project có một graph dùng chung và hai view; không nhân bản graph khi chuyển view. Không hứa đường nối tránh mọi vật cản hoặc bố trí tối ưu toàn cục cho mọi graph.

## 2. Hai đợt triển khai

| Đợt | Task | Kết quả |
|---|---|---|
| 1 — Node ảnh và Mind Map thủ công | MM001–MM012 | Node styles, ảnh đại diện, hai view giữ vị trí riêng, Root/branch/reference, nhánh cong có màu, đầy đủ Detail/Format và export/import |
| 2 — Bố trí và quản lý nhánh | MM013–MM020 | Layout radial có preview/Apply/Cancel và một undo, mở/thu gọn nhánh, kiểm tra readability/performance và nghiệm thu toàn bộ |

Thứ tự theo dependencies trong CSV. Khi được yêu cầu thực hiện code tính năng này, hoàn thành đợt 1 trước đợt 2; chỉ thực hiện đợt được user giao. User đã giao triển khai đợt 1 MM001–MM012; đợt 2 vẫn TODO.

## 3. Model và hợp đồng đề xuất

MM001 chốt chi tiết schema/validators/types/serializer trước code renderer. Hướng ưu tiên: giữ JSON version **1.0**, dùng extensions có namespace và kiểm tra typed/bounds cho các namespace do ứng dụng sở hữu. Không thêm top-level field ngoài schema hiện tại. Nếu prototype chỉ ra cần thay hợp đồng, ghi quyết định/migration trước khi đổi, không âm thầm sửa version.

### 3.1 Một model node chung

Tiếp tục lưu node trong cards[] để tái sử dụng store/commands/history/Detail. Không dùng trường type phân loại nội dung làm enum hình dạng.

Namespace card.extensions['card-atlas:node'] đề xuất:

- kind: card | text | image | image-text.
- coverImageId: ID trong card.extensions['card-atlas:images']; bắt buộc với image/image-text.
- imageFit: contain | cover; mặc định contain, không làm méo tỷ lệ.
- imageAlt: mô tả ảnh cho accessibility; có fallback từ tên ảnh/title.

Ảnh dùng attachments nhúng hiện có, không tạo bản Base64 thứ hai riêng cho Canvas. Node image vẫn có title không rỗng làm tên trong sidebar/search/Detail/accessibility, nhưng có thể ẩn title trên Canvas. Kind card ở Mind Map được thể hiện bằng title ngắn; không thay đổi kind gốc chỉ vì đổi view. Kiểu text không mất summary/tags/content đã có khi đổi từ card.

| kind | Card Map | Mind Map |
|---|---|---|
| card | Card overview hiện có | Text node theo title |
| text | Text node gọn | Text node |
| image | Ảnh độc lập, có connector | Ảnh độc lập |
| image-text | Ảnh và title/caption | Ảnh và text |

Chỉ dùng ảnh nhúng raster được hỗ trợ hiện tại cho cover trong đợt này. Không tự lấy ảnh đầu tiên trong Markdown hoặc tự tải URL ngoài. Chọn/thay/gỡ cover là draft + Apply/Cancel. Khi xóa attachment đang làm cover, UI yêu cầu chọn cover khác hoặc đổi kind sang text/card; không âm thầm mất tham chiếu. Import cover thiếu/sai ID phải báo path cụ thể trước replace. Giữ giới hạn JSON 10 MiB, 500 nodes, 2.000 relations và 100.000 ký tự content/node.

### 3.2 Vị trí riêng từng view

Card Map dùng card.position/card.size và project.canvas như hợp đồng cũ. Mind Map dùng overrides theo node ID trong project.extensions['card-atlas:views'].mindMap: positions và sizes. Node không có override dùng vị trí/kích thước khởi tạo xác định, không chồng tất cả về (0,0).

- Chuyển view chỉ là session state; không tự chạy layout, không đổi nội dung, positions, dirty hoặc history.
- Drag/resize trong view nào chỉ cập nhật geometry view đó bằng command atomic, có undo/redo.
- Canvas switch chỉ resize/rebind renderer và giữ selection ID; mở Detail, draft và guards tiếp tục đúng.
- Pan/zoom mỗi view là session state, có thể được snapshot khi export như canvas hiện tại. MM001 phải định nghĩa serializer overlay và loại viewport khỏi content dirty/history; không ghi pan/zoom trực tiếp như mutation project.
- Export giữ cả hai bộ geometry; project.canvas vẫn là viewport Card Map, viewport Mind Map có namespace riêng. Import cũ không có namespace mở Card Map mặc định; không tạo dữ liệu Mind Map ngầm chỉ do đọc file.
- Delete node xóa incident relations, geometry overrides và cấu hình Root liên quan trong cùng transaction; undo khôi phục tất cả. Duplicate sao chép ảnh/style và tạo ID mới cùng geometry đúng view.

### 3.3 Root, branch và reference

Project.extensions['card-atlas:mind-map'].rootId chỉ định Root. Relation.extensions['card-atlas:mind-map'].kind: branch | reference; relation thiếu namespace được hiểu là reference. source → target của branch là parent → child.

- Một node tối đa một parent branch; branch graph không cycle; Root không có parent branch; giữ quy tắc không self-loop hiện có.
- Cycle/parallel edges của graph tổng thể vẫn hợp lệ nếu là reference. Không tự đổi mọi relation cũ thành branch hay xóa relation để ép graph thành cây.
- Cho phép node rời hoặc nhánh chưa thuộc Root; hiển thị rõ nhóm chưa gắn Root. Người dùng chủ động chọn Root/gán branch. Khi chưa có Root, vẫn đọc/di chuyển node được và có hướng dẫn chọn Root.
- Xóa Root làm rootId rỗng; các node còn lại không mất nội dung. Không tự chọn Root mới. Chuyển Root được preview/validate trước Apply nếu node mới đang có parent; thao tác tháo parent/chọn Root phải rõ và atomic.
- Cross-links/reference có style nhẹ, dễ phân biệt với branch, không quyết định cây/layout hoặc màu nhóm.
- Màu mặc định theo nhánh cấp 1 phải xác định và ổn định, không đổi hàng loạt chỉ vì xóa sibling. Override màu Mind Map lưu riêng; không ghi đè relation.style.color của Card Map. Màu không phải tín hiệu phân loại duy nhất.

## 4. Đợt 1: giao diện và tương tác

Toolbar có control Card Map / Mind Map, dùng được bằng bàn phím và dịch vi/en. Detail Format có loại node, cover picker, contain/cover và geometry theo active view. Các điều khiển không áp dụng cho kind hiện tại được giải thích hoặc ẩn rõ ràng, không để nút vô tác dụng.

Mind Map node chỉ hiện title/text/cover, không lộ Markdown dài hoặc toàn bộ metadata. Root có dấu hiệu dễ nhận biết. Branch cong phải thật sự nhìn thấy ở single edge; không coi việc đang dùng curve-style=bezier là đã đủ. Prototype MM002 kiểm tra khả năng điều khiển điểm cong trong Cytoscape hiện có, anchors/bounds và hit-testing trước khi quyết định có cần renderer bổ sung.

Click khác drag theo threshold hiện có. Click text/image hoặc Enter mở Overview; drag chỉ di chuyển node; connector không mở Detail ngoài ý muốn. Text và image cùng node mở cùng ID. Các node khác nhau có Detail riêng. Giữ Fit/Focus, search toàn văn, relation selection, editor guards, duplicate/delete, undo/redo và recovery opt-in.

Node ảnh có placeholder/loading/error rõ, alt label và vùng bấm dễ dùng; giữ tỷ lệ sau decode, không dịch chuyển layout đột ngột. Tiếp tục chính sách không runtime CDN/không tự tải ảnh ngoài. Preview ảnh trong Detail hiện tại giữ 100% natural size; không ép ảnh overview Canvas hiển thị 100%.

## 5. Đợt 2: layout radial và thu gọn

Layout là hàm thuần lấy branch forest, Root và kích thước node đã xác định; output positions mới, không sửa nội dung/relations hay Card Map geometry. Prototype so sánh phương án bố trí radial có xét bounding boxes và chia vùng nhánh; ưu tiên determinism, readability và khả năng bảo trì hơn mô phỏng vật lý ngẫu nhiên.

Nút Sắp xếp Mind Map mở preview riêng; người dùng có Apply/Cancel/Reset preview. Preview không thay project/history/dirty, không cho thao tác khác âm thầm commit tọa độ tạm. Apply ghi tất cả Mind Map positions trong một transaction; một undo phục hồi nguyên bộ. Hủy, đổi view hoặc rời preview xử lý rõ để không mất draft. Không tự chạy khi import/switch view.

Nếu không có Root, yêu cầu chọn trước khi layout. Node rời được đặt trong vùng riêng, không bị mất. Reference edges không ảnh hưởng bố trí cây. Thứ tự sibling xác định; khoảng cách xét actual bbox text/image và zoom-independent world coordinates. Fixture chuẩn phải không chồng node; dữ liệu khó phải có cảnh báo và vẫn cho sửa thủ công. Không cam kết mọi đường cong tránh node khác.

Thu gọn/mở nhánh là session view state, không xóa node/relation/attachments và không làm dirty/history. Chỉ tính descendants theo branch, không theo reference. Ẩn edges khi một đầu bị ẩn; không tạo edges tới node vô hình. Hiện số node ẩn. Search có thể mở đúng đường tổ tiên để Focus kết quả, phục hồi selection hợp lệ; Detail không trỏ tới node bị xóa. Export graph vẫn chứa toàn bộ nội dung; trạng thái collapse chưa lưu thành dữ liệu project trong đợt này.

## 6. Kiểm chứng và release gates

Không đặt thời gian thực hiện trước prototype. MM001/MM002 xác định điểm khó về contract/renderer; MM013 xác định thuật toán layout. Không tự cài dependency mới nếu renderer hiện có đáp ứng được; nếu cần, kiểm tra docs chính thức, bundle local và ghi version/license.

Unit tests tập trung vào cover refs, geometry isolation, branch invariants/cycle, cleanup atomic, layout determinism/bounds và round-trip. Browser kiểm tra click/drag/connect trên text/image, active-view resize, switch khi draft, vi/en, light/dark, Fit/Focus, loading ảnh, guard/export/undo và recovery. Kiểm tra rawHTML/unsafe image/extension CSS và không có request ngoài bất ngờ.

Fixtures: JSON cũ; mixed card/text/image/image-text; Root với >=3 nhánh và >=4 cấp; ảnh ngang/dọc; cover thiếu; reference cycle/parallel; branch cycle/two parents; node rời; xóa Root/cover; đổi view nhiều lần; 500nodes/2.000relations với images hợp lệ và file <=10MiB.

Target giữ như dự án: import-to-interactive <=3s; Overview <=200ms không tính Mermaid; median pan/drag >=45FPS trên máy ghi trong evidence. Đo riêng khi không chạy browser suite đồng thời. MM019 ghi thời gian layout/preview và độ chồng lấn; target layout/preview <=3s cho fixture500nodes trên máy benchmark, không tăng giới hạn hay target để che lỗi. Renderer hiện tại được so sánh hồi quy Card Map.

MM012 là gate đợt 1: MM001–MM011 DONE có evidence, checks bắt buộc pass, ảnh/template và compatibility xác nhận. MM020 là gate đợt 2/toàn tính năng: MM012–MM019 DONE có evidence, layout/collapse/geometry isolation/network/security/benchmark pass; README/Format Guide và plan đồng bộ. Không đánh dấu DONE khi chỉ có demo hoặc code.

## 7. Các file dự kiến khi triển khai

- index.html: control view và actions.
- assets/js/canvas/: renderer styles, node image, edge curves và view bindings; tách module khỏi adapter lớn nếu cần.
- assets/js/graph/: node/branch queries và radial layout thuần.
- assets/js/store/: geometry commands, session per-view và recovery integration.
- assets/js/json/: namespace contracts/validation/serialization; assets/data/ cho ví dụ và guide.
- assets/js/detail/: node Format/cover picker, giữ editor/Overview hiện có.
- assets/css/ và assets/js/i18n/: hai view, loading/focus states và vi/en.
- tests/: core + browser fixtures; planning/ cho evidence/screenshot/benchmark.

## 8. Tiến độ hiện tại

MM001–MM020 DONE. Tổng75 DONE,10 BACKLOG; không blocker hoặc task đang dở.
Đợt 2 dùng weighted sectors + bbox depth rings, deterministic ID order và forest packing; preview session độc lập, Apply một command, collapse không export/recovery. Với ≥1.000 edges, tạm hoãn vẽ edges khi pan/zoom/drag và khôi phục sau160ms idle để đạt target; dữ liệu và chọn relation khi dừng giữ nguyên.
Core33/33, lint/typecheck/format/build pass; benchmark500/2000 pass cả hai view, Mind preview647ms/0overlap/pan59.88FPS. Full UI147/147 Chrome/Edge/Firefox pass; release gate MM020 DONE.
Evidence: [mind-map-phase2-evidence.md](mind-map-phase2-evidence.md). Đợt 2 hoàn tất, không triển khai BACKLOG.
