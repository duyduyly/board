# Đánh giá và hoàn thiện Feedback 01

> **Chế độ:** QUICK — đánh giá một nguồn feedback, đối chiếu code hiện tại.
> **Ngày:** 2026-10-12
> **Tóm tắt:** Sáu đề xuất khả thi; ưu tiên Gallery, Detail tập trung và click xem ảnh, tiếp theo trao đổi node offline, cuối cùng geometry hình dạng và auto-size.
> **Nguồn:** wordspace/tasks/01-feedback/feedback-01.md mục 1–6 và img.png; index.html; canvas/adapter.js; detail/editor-fields.js, appearance.js, writing.js, image-preview.js; docs/development.md; planning/implementation-plan.md.
> **Trạng thái:** Đề xuất thiết kế, chưa triển khai, chưa có usability test hoặc prototype mới. Không sửa yêu cầu gốc.

Card Atlas là editor sơ đồ có card/text/ảnh, nội dung đầy đủ nằm trong Detail. Feedback hướng tới trải nghiệm bắt đầu nhanh, tạo sơ đồ phong phú và đọc nội dung tập trung. Cả sáu ý làm được với root index.html + assets và JavaScript ESM hiện tại. Phần khó nằm ở hình học và trao đổi dữ liệu, không phải dựng các nút.

## Tổng quan UX/UI và khả thi

| Nguồn | Đánh giá trải nghiệm và thẩm mỹ | Khả thi / khối lượng tương đối |
|---|---|---|
| 1 Gallery | Dễ chọn, đẹp hơn màn hình trống nếu preview có cùng phong cách | Cao / vừa; cần nội dung template và preview |
| 2 Sidebar hình dạng | Hữu ích khi tạo map, dễ thành lưới icon quá tải; cần phân nhóm | Cao / lớn; geometry, borders, anchors, text bounds |
| 3 Markdown và JSON node | Rất hữu ích cho viết offline, cần phân biệt hai loại import | Cao / vừa–lớn; validation, ảnh, conflict policy |
| 4 Detail giữa màn hình | Tăng tập trung đọc, giảm quan sát graph khi mở | Cao / vừa; tái sử dụng Detail, quản lý draft/focus |
| 5 Font lớn và auto-size | Tốt cho tiêu đề/mind map; dễ phá bố cục nếu tự tăng không giới hạn | Cao / lớn khi kết hợp mọi shape |
| 6 Click xem ảnh | Chủ động hơn hover, dùng được bàn phím và touch | Cao / nhỏ–vừa; overlay và focus khi nằm trong Detail |

Đây là đánh giá định tính dựa trên source, không phải số đo mức hài lòng. Tổng scope là một nâng cấp đáng kể, không phải sáu chỉnh CSS nhỏ. Không cần thay framework/backend. Responsive Gallery không đồng nghĩa editor mobile đã được hỗ trợ.

## 1. Home: Template Gallery

**Yêu cầu gốc:** header New Project/Import JSON, category Personal/Learning/Work/Project, grid ảnh và title, toàn card mở template, không metadata/description/button trong card.

**Đề xuất hoàn thiện:**
- Home là màn hình riêng trong cùng entry; editor có nút về Home. Khi quay lại Home trong cùng phiên, có thể tiếp tục project đang mở; mở template khác phải qua guard draft/project hiện có.
- Template là bản mẫu đóng gói sẵn trong assets, không phải danh sách project tự lưu. Category thuộc catalog template, không phải tags của node.
- Header giữ theme và vi/en. Bộ lọc dạng tab nhẹ, mặc định All; chỉ thêm ô tìm template khi catalog đủ lớn để thực sự cần.
- Desktop 4–5 cột theo chiều rộng khả dụng; tablet 3, mobile 2 khi title vẫn đọc được, hẹp hơn cho phép 1. Không ép 5 cột ở màn hình nhỏ.
- Đề xuất preview tỷ lệ 4:3, title tối đa 2 dòng, gap 20–24px, viền nhẹ, radius 10–12px, một màu accent thống nhất. Ảnh preview dùng chính sơ đồ của template, tránh mỗi tile một kiểu ảnh quảng cáo.
- Hover/focus chỉ nhấn viền và nâng rất nhẹ. Click, Enter/Space mở được; tên accessible lấy từ title. Preview trang trí có alt rỗng.
- Loading có skeleton đúng kích thước; file template lỗi báo rõ và giữ project trước đó. Category rỗng có lời giải thích, không có tile giả.
- Có thể bắt đầu với 4–6 template thực sự hữu ích; không cần làm nhiều tile để lấp lưới.

**Acceptance:** chọn template tạo project độc lập; không sửa file template; New/Import/Back đều giữ guards; vi/en, theme và layout Home kiểm tra riêng.

## 2. Sidebar: thư viện Shapes, Text, Images

**Yêu cầu gốc:** bỏ sidebar trong ảnh, thay bằng thư viện hình mẫu như draw.io.

**Điểm cần bổ sung:** Sidebar đang chứa search/list/count/JSON Guide/recovery. Bỏ nguyên khối sẽ mất điều hướng và trạng thái dữ liệu. Đề xuất sidebar mặc định là thư viện mới; search/list chuyển sang drawer “Tìm & điều hướng”, Guide/recovery chuyển menu dự án. Không giữ panel cũ chiếm chỗ, nhưng giữ chức năng ở vị trí rõ ràng.

- Thư viện có nhóm Basic, Flowchart, Symbols, Text, Images. Shape icon có label/tooltip vi/en, không chỉ dựa vào icon.
- Phân biệt **node kind** (card/text/image/image-text) với **shape** (rectangle/ellipse/diamond...). Hình dạng không phải type ngữ nghĩa; mọi node tiếp tục có Detail.
- Click shape tạo node tại giữa viewport; kéo từ palette thả canvas tạo tại vị trí đã đổi từ screen sang graph, tính đúng pan/zoom. Có cách tạo bằng bàn phím tương đương.
- Đổi shape của node đã chọn nằm ở Format. Không để một click palette lúc thì tạo mới, lúc thì sửa selection mà không có dấu hiệu.
- Đợt đầu: rectangle, rounded rectangle, square, circle, ellipse, diamond, triangle, hexagon. Oval/ellipse dùng một tên; square và circle khóa tỷ lệ, không cần renderer riêng.
- Đợt sau: star, heart, octagon, arrow và các biến thể triangle. Không cần liệt kê mọi hình ngay từ đầu.
- Card dài dùng rectangle/rounded; shape biểu tượng dùng title ngắn, summary/tags có thể chỉ ở Detail. Nội dung không mất khi đổi shape.
- Text/image nodes vẫn độc lập; ảnh trong shape giữ contain/cover và alt. Default của Mind Map tiếp tục nhẹ, shape là lựa chọn chủ động.

**Khó về kỹ thuật:** hiện Cytoscape node vô hình round-rectangle, card thật là HTML overlay. Thay clip-path một mình không đủ: viền có thể sai, vùng click vẫn hình hộp, edge chạm sai vị trí, resize/connector bị clip. Cần shape registry dùng chung cho visual outline, safe text area, aspect ratio, hit testing và connection anchors; SVG outline hoặc polygon chuẩn hóa là phương án cần prototype. SVG ở đây là hình do ứng dụng tạo, không mở upload SVG tùy ý.

Cytoscape có node shapes và polygon, nhưng việc khớp HTML overlay/anchors vẫn là công việc của dự án: [tài liệu chính thức](https://js.cytoscape.org/#style/node-body).

**Thẩm mỹ:** quá nhiều hình và màu trong cùng map làm giảm khả năng đọc. Giữ mặc định nhất quán, gợi ý dùng hình theo vai trò và hạn chế 2–3 nhóm hình trong một map; đây là khuyến nghị, không ép dữ liệu người dùng.

**Acceptance:** hình/viền/vùng click/điểm nối khớp ở zoom 10–400%; không cắt control; đổi shape + size undo nguyên khối; round-trip cũ/mới; text không vượt safe area.

## 3. Viết offline: Import Markdown và trao đổi từng node JSON

**Hiện có:** xuất Markdown đã thay attachment:id bằng data URI cho ảnh nhúng; xuất toàn project JSON có Base64. Chưa có import Markdown hoặc workflow trao đổi riêng node. Markdown chứa ảnh không bảo đảm mọi editor ngoài ứng dụng render data URI.

Cần hai thao tác khác nhau:
1. **Nhập nội dung .md** vào draft của node đang mở: preview trước, chọn Replace content hoặc Append. Giữ title/tags/style mặc định; không tự suy đoán metadata từ heading.
2. **Nhập/xuất node .json**: toàn bộ title/summary/type/tags/content/appearance/node kind và ảnh nhúng, để sửa offline rồi đưa lại.

**Khuyến nghị format giai đoạn đầu:** dùng project JSON 1.0 hợp lệ chứa đúng một card, relations rỗng, geometry/extension chỉ giữ phần liên quan. Như vậy có thể tái sử dụng validator và còn mở được file độc lập. Đây là phương án đề xuất, chưa chốt contract. Không copy Root/views chứa ID không tồn tại hoặc relation ra các node bên ngoài.

- “Xuất node” lấy bản đã Apply mặc định; nếu draft chưa Apply, lựa chọn Xuất bản nháp phải rõ ràng và validate trước. Export không tự Apply.
- Import riêng node có preview và hai hành động: Cập nhật nội dung node hiện tại hoặc Thêm node mới. Cập nhật giữ ID và relations hiện tại; thêm mới cấp ID tránh trùng, đặt vị trí trong viewport. Không replace toàn project.
- Mặc định cập nhật nội dung + ảnh, giữ shape/geometry; tùy chọn rõ ràng nếu muốn lấy cả format. Apply một transaction; Cancel không đổi project.
- Chỉ xuất ảnh nhúng được tham chiếu trong content hoặc cover. Thiếu ảnh phải báo; ảnh URL chỉ giữ URL, không âm thầm tải thành ảnh nhúng.
- Remap attachment ID khi thêm/gộp tránh ảnh cũ bị đổi; không xóa ảnh đang dùng làm cover. Unknown extensions cần policy giữ/báo lỗi, không âm thầm mất.
- .md có đường dẫn tương đối như images/a.png: trình duyệt không tự đọc file lân cận trên máy. Người dùng chọn thêm ảnh hoặc một gói chứa .md + images. Mặc định không fetch URL ngoài; giữ cơ chế cho phép ảnh ngoài hiện có.
- Đợt đầu hỗ trợ .md text và node JSON tự chứa ảnh. ZIP .md + images để editor ngoài dùng thuận tiện là đợt sau; cần parser ZIP và giới hạn giải nén, không nên thêm vội.
- Giữ giới hạn project 10 MiB, raster PNG/JPEG/WebP/GIF và validation MIME hiện tại. Base64 làm file lớn hơn; phải đo kích thước kết quả trước khi Apply/export.
- File JSON xuất là snapshot; sửa và import lại có thể ghi đè nội dung đã đổi trong ứng dụng. Preview phải cho thấy phạm vi cập nhật, không hứa merge tự động.

Browser chỉ có đường dẫn tương đối của những file được người dùng chọn: [MDN File.webkitRelativePath](https://developer.mozilla.org/en-US/docs/Web/API/File/webkitRelativePath).

**Acceptance:** viết offline → import → preview → Apply → undo → export/reimport không mất ảnh/cover/content; file lỗi giữ draft; không request ngoài hoặc replace project ngầm.

## 4. Detail tập trung ở giữa màn hình

**Yêu cầu gốc:** modal giữa, cỡ 75% hoặc full, nền tối và click nền/X đóng.

- Default mở ở giữa, đề xuất rộng 75vw nhưng giới hạn khoảng 960–1120px cho desktop; cao tối đa 85–90vh. Full là 100% vùng trình duyệt, không bắt buộc Fullscreen API.
- Body đọc giới hạn khoảng 70–85 ký tự mỗi dòng; Full mở rộng workspace viết/preview, không kéo paragraph dài hết màn hình. Header/tabs/footer cố định, chỉ body cuộn.
- Giữ Overview/Edit/Format, TOC, Markdown/Mermaid, writing preview, cursor/scroll và attachment tools. Đây là đổi container của Detail, không tạo bản editor thứ hai.
- Single click select node; double click hoặc action Open mở Detail. Enter trên node mở được. Điều này tránh drag/click nhẹ liên tục bật modal. Ý gốc “ấn vào” chưa chốt single/double click; đây là khuyến nghị.
- X, Escape và click đúng backdrop đi qua cùng close guard. Draft chưa Apply phải có Apply/Discard/Stay, tuyệt đối không đóng và mất nội dung chỉ vì click nền.
- Không đóng khi pointer bắt đầu trong modal rồi kết thúc ngoài, hay khi người dùng chọn văn bản. Canvas bên dưới không pan/drag khi đang modal.
- Focus vào heading/đầu nội dung phù hợp, Tab ở trong modal, đóng trả focus về node/nút mở. Khi ảnh phóng to đang mở, Escape đóng ảnh trước; Escape tiếp theo mới đóng Detail.
- Có thể bổ sung “Ghim bên phải” sau để làm việc với graph và Detail đồng thời, nhưng không đưa thành điều kiện bắt buộc của đợt đầu.

Modal cần focus contained, Escape và background inert theo [WAI Dialog Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/). Native dialog là lựa chọn cần thử cùng dialog guard hiện tại.

**Thẩm mỹ:** nền tối vừa phải, surface sáng/tối theo theme, shadow nhẹ, không blur mạnh. Tập trung bằng bố cục và chiều dài dòng, không chỉ làm khung lớn.

**Acceptance:** không mất draft/cursor khi resize/full/locale; đóng đúng guard; focus và nested image viewer đúng; không chặn confirm dialog.

## 5. Kéo, resize và font lớn tự điều chỉnh card

Kéo node đã tồn tại; feedback có thể ám chỉ kéo resize bằng chuột. Đề xuất bổ sung resize handles rõ khi selected, tránh nhầm với connection handles. Chưa coi drag hiện tại là thiếu tính năng.

- Font hiện giới hạn 12–24 cả UI và validator. Đề xuất 12–72px cho title/text, presets 14/18/24/32/48; chưa coi 72 là contract đã được chấp thuận. Font body Detail độc lập.
- Format có chế độ kích thước Manual và Fit text. Manual giữ width/height; Fit text tính kích thước vừa nội dung overview, không đo Markdown dài.
- Khi đổi font, preview size trước; Apply font+size trong một transaction. Không resize committed model trên mỗi render, theme switch hoặc font load.
- Fit text giữ width mục tiêu trong giới hạn, wrap rồi tăng height; không tăng cả width/height vô hạn. Với circle/square giữ tỷ lệ; với diamond/triangle dùng safe area thật.
- Giá trị tối đa của size cần giữ contract hoặc chốt nâng cấp trước. Không clip text âm thầm; nếu vượt giới hạn báo rõ và đề nghị giảm font/rút ngắn title/manual.
- Manual resize có min-size theo shape và snapping tùy chọn. Resize chỉ đổi geometry active view, không làm Card Map và Mind Map đồng thời thay đổi.
- Font lớn có thể tạo overlap với node khác; không tự chạy radial layout sau mọi lần sửa. Đề xuất báo nhẹ và nút Arrange/Fit hiện có.
- Auto-size phải xác định ổn định theo font, padding, line-height, loại shape; không phụ thuộc zoom camera và không vòng lặp ResizeObserver.

**Acceptance:** 32/48/72px đọc rõ, preview/apply/undo atomic, legacy font đúng, không overlap do auto-layout ngầm, viewport không đổi dữ liệu.

## 6. Click phóng ảnh, bỏ hover tự mở

- Ảnh trong Detail đề xuất max-width 100% vùng nội dung, max-height khoảng 320–400px và object-fit contain; không crop ảnh học tập.
- Click hoặc Enter/Space mở image viewer; hover chỉ đổi cursor/viền gợi ý. Không tự mở khi rê chuột.
- Viewer mặc định Fit, ảnh không vượt khoảng 75vw × 75vh; ảnh nhỏ không upscale vượt kích thước tự nhiên. 75% hiểu theo viewport, không phải 75% số pixel của ảnh.
- Nút X, Escape và backdrop đóng; tên/alt ngắn, nút Fit/100% nếu cần xem chữ nhỏ. 100% là thao tác chủ động, có pan/scroll, không phá default Fit.
- Tái sử dụng đúng nguồn ảnh đang được phép render. Nếu ảnh URL chưa được cho phép, không fetch chỉ vì mở viewer.
- Viewer không đi qua draft guard vì không sửa nội dung; đóng quay về ảnh đã bấm và vị trí cuộn cũ. Nếu mở trong Detail modal, xử lý focus/modal stack.
- Loading/error rõ, ảnh GIF giữ hành vi hiện có; không cần thêm editing/crop ảnh vào scope.

**Acceptance:** hover không bật viewer, click/keyboard bật; ảnh portrait/landscape/nhỏ/lớn đúng giới hạn; không gây request ngoài mới; Escape ưu tiên đóng viewer.

## Những quyết định chưa chốt

| ID | Cần chốt trước triển khai | Khuyến nghị |
|---|---|---|
| Q1 | Mở Detail bằng single click hay double/Open | Select bằng single, mở bằng double/Open |
| Q2 | Palette đổi selection hay tạo node mới | Palette tạo; Format đổi shape |
| Q3 | Node file contract và phạm vi update | One-card project1.0; cập nhật content/ảnh mặc định |
| Q4 | Trần font và size mode | 12–72, Manual/Fit text có giới hạn |
| Q5 | Sidebar search/recovery đi đâu | Drawer điều hướng + menu dự án |
| Q6 | Offline ảnh relative có ZIP ngay không | Đợt đầu node JSON portable; ZIP sau |

Các lựa chọn trên là đề xuất của đánh giá, chưa phải quyết định đã được người dùng duyệt. Không có blocker công nghệ đã biết; shape/anchors và modal stack cần prototype để chứng minh.

## Thứ tự triển khai đề xuất

1. Gallery + Detail modal + click image viewer: cải thiện rõ nhất, giữ graph model.
2. Markdown import và node JSON portable: chốt contract/guards/attachment trước.
3. Shape registry prototype → palette/Format → resize/font/Fit text → benchmark.
4. Polish vi/en/light/dark, regression Chrome/Edge/Firefox, 500/2.000 và network/storage.

Không tự chuyển các BACKLOG hiện tại thành task bắt buộc. Khi user giao implement, tách checklist có acceptance/dependencies và đồng bộ spec trước sửa model.

## Kiến trúc và giới hạn đánh giá

Dùng ui/template-gallery, ui/shape-palette, detail/detail-dialog, detail/image-viewer, detail/node-transfer, graph/shape-registry và graph/fit-text khi feature thực sự triển khai; app chỉ điều phối callbacks/guards. JSON validators và commands giữ độc lập renderer. Tên module là định hướng, không yêu cầu tạo module rỗng.

Không có mockup hay user testing mới; đánh giá thẩm mỹ là định hướng. Không ước lượng giờ khi chưa prototype shape/import. Giữ báo cáo QUICK bằng Markdown; không tạo HTML hoặc business map vì lượt này tập trung sáu đề xuất và user chưa yêu cầu các artifact đó.

Kiểm tra artifact: đã đọc lại UTF-8 và nội dung đủ sáu mục. Script business_context.py được SKILL.md yêu cầu không có trong package local và không tìm thấy trong skill directory của người dùng; lệnh sync thất bại vì thiếu file. Vì vậy business INDEX/marker không được tự cập nhật; không ghi đè thủ công index được skill quản lý. Source ứng dụng và checklist triển khai chưa thay đổi.
