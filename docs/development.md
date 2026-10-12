# Phát triển và mở rộng Card Atlas

Entry vẫn là index.html ở gốc, JavaScript ESM và thư viện local trong assets/. app.js điều phối session, commands và các controller. Module nhỏ nhận dữ liệu hoặc callback rõ ràng; module cấp thấp không import ngược app.js.

| Module | Trách nhiệm |
|---|---|
| common/html, data | Escape HTML và clone thuần; không biết DOM/project |
| common/dom, download | Browser primitives; không biết commands hay i18n |
| graph/ | Geometry, branch, radial layout và chỉ mục truy vấn |
| json/ | Contract, validate, stage và serialize |
| store/ | Commands atomic, history và recovery opt-in |
| detail/editor-fields | Dựng markup từ dữ liệu; không sửa draft |
| detail/appearance | Policy và cách hiển thị appearance dùng chung cho Canvas/preview |
| ui/ | Form controls, dialog/toast, sidebar và Format Guide |
| canvas/adapter | Cytoscape và HTML overlays; chỉ đọc model/session |
| css/ | Base → theme → workspace, theo thứ tự trong app.css |

## Thêm tính năng

1. Ghi yêu cầu và acceptance vào planning; xác định dữ liệu thuộc model hay session, chốt namespace trước khi code.
2. Viết command atomic và truy vấn thuần; kiểm tra validation, Undo và JSON round-trip.
3. Thêm field builder trong detail hoặc controller trong ui, nhận callbacks từ app; giữ các guards hiện có.
4. Renderer đọc geometry/model/session options, không sửa snapshot.
5. Dùng t(key) cho UI Việt/Anh; không dịch nội dung người dùng. Thêm style vào đúng lớp CSS và kiểm tra cả hai theme.
6. Chạy npm test, npm run check, npm run typecheck, npm run format:check; bổ sung browser/benchmark theo ảnh hưởng.

Chỉ đưa code vào common khi có ít nhất hai caller thực tế và cùng policy. Escape HTML không thay DOMPurify: Markdown/Mermaid vẫn phải sanitize. JSON clone trong validator có mục đích khác structuredClone của session, nên giữ riêng. Fixtures có mục đích khác nhau không gom chỉ vì cùng tên sample.

## Query cache

projectIndex(snapshot) xây cards/relations/degrees/incoming/outgoing trong O(N+E), lưu qua WeakMap. Chỉ dùng với committed snapshot; không dùng bên trong mutator đang sửa object và không sửa Map/array trả về. Commit, Undo hoặc Replace tạo snapshot mới nên nhận index mới. Locale và viewport không đổi dữ liệu graph. Cache không export, không nằm trong history hoặc recovery; snapshot cũ có thể được GC.

## Gates tự động

npm run check dùng ESLint AST để kiểm tra import/export: vòng phụ thuộc, module thiếu, common import ngược và module cấp thấp import app. no-unused-vars bắt import thừa sau khi tách code.

npm run typecheck kiểm tra contract TypeScript và checkJs cho common/html, common/data, graph/project-index. UI JavaScript chưa được typecheck toàn bộ; mở rộng từng module có JSDoc, không tắt strict để che lỗi.

## Giới hạn

app.js vẫn giữ workflow Edit/Apply/import/recovery/layout vì chúng chia sẻ guards và session. Khi thêm workflow lớn, tách controller với ports/callbacks cụ thể; tránh chuyển nguyên khối sang một controller lớn khác. Chưa cần plugin registry hoặc framework mới khi chưa có use case được giao.

Nguồn chính thức: [MDN JavaScript modules](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules), [Cytoscape batch](https://js.cytoscape.org/#cy.batch). Cấu trúc và boundaries trên là quyết định của dự án.

## Gallery và Detail modal

ui/template-gallery sở hữu catalog/category/loading và nhận callback onOpen, không giữ project model. ui/dialog-surface dùng native dialog top layer, capture trigger, Escape/backdrop và requestClose có khóa chống double-submit. Detail gọi guardDraft ở app; image viewer đóng không mutate draft. Project tools trong Detail đi qua cùng actions/commands, không có controller thứ hai.

home/detailOpen/expanded/image viewer thuộc session. Thay project thành công chuyển vào editor, lỗi/cancel giữ Home/project trước đó. Single click của mọi node chỉ select; double/action/Enter open. Test driver chỉ thao tác controls hiển thị, không bypass inert. Khi viết benchmark phải vào editor trước đo; close Detail trước pan canvas.

## Document/node transfer

json/node-transfer giữ transforms thuần: one-card serializer/staging, reference checks, namespace filtering, conflict/attachment merge, Add/Update geometry. detail/markdown-import decodeUTF8 fatal và stageMarkdown/dataURI→attachments, không DOM/fetch. ui/document-transfer sở hữu file/preview/options và nhận ports context/isCurrent/useDraft/addNode/dialog/toast; không import app/store. app chỉ nối draft/geometry/guards/command. Preview render sau khi dialog mount, isCurrent loại kết quả async cũ. File size kiểm trước arrayBuffer; candidate validate trước use/commit. Update không Apply ngầm; export không gọi store.exported.

## Shapes và đo tổng quan

graph/shape-registry là nguồn outline/safeArea/ratio/hit/anchor/minmax; graph/fit-text là thuật toán fit thuần, nhận callbackmeasure. canvas/overview dựng nội dung dùng chung Canvas/Format/measurement; shape-view dùng registry cho SVG và normalized Cytoscape polygon. Controls nằm ngoài safe-content, không bị clip. canvas/text-measure clone overview ẩn và cache width trong một phép đo; không đọc Markdown/body, không ghi model. canvas/resize-node giữ pointer preview ngoài ProjectStore, cleanup trên cancel/lostcapture/blur/Escape; callback một command saupointerup. Sync/locale/theme hủy resizeđangdở; guards khóa history/view trong pointer transaction.

ui/shape-palette nhận onCreate/locked; app nối file stage+guards+atomic command, geometry activeview. detail/image-file dùng chung upload/palette; validate/decode raster offline trước mutation và từ chối kết quả stale. Không thêm framework/CDN/storage. BasicShapes demo là project1.0, FormatGuide tải cùngschema. NodeAppearance typed trong graph/types.ts/schema và appearance runtime.

Extended shapes cùng registry và typed contract; triangle là equilateral alias, không enum duplicate. Concave safeArea được test cả4góc; anchors lấy ray intersection gần nhất từ tâm nội bộ. Right triangle chuyển bounds center trên cạnh sang polygon centroid. Mỗi shape mới phải cập nhật schema/types/i18n/examples và test SafeArea/anchor/resize/Fit tại12–72; không nhận polygon từ JSON.
