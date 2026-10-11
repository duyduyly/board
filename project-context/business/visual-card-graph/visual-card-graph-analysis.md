# Đánh giá JSON-driven Visual Card Graph Editor

> **Tóm tắt:** Ý tưởng khả thi và có định hướng rõ; cần chốt hợp đồng JSON, phạm vi V1 và quy tắc bảo toàn dữ liệu trước khi triển khai đầy đủ.
> **Chế độ:** QUICK — đánh giá định hướng từ một nguồn, không phải kiểm toán toàn bộ yêu cầu.
> **Ngày:** 2026-10-11
> **Nguồn:** [Đặc tả](../../../wordspace/docs/json-driven-visual-card-graph-editor-spec.md), mục 1–60; tài liệu không có số phiên bản riêng.
> **SHA256 nguồn:** 4030AEFC0E325A006D5808CBEC9B051A9835DB773BEC0F1AE915A611D90DE663
> **Giới hạn:** Chưa có mã ứng dụng trong các thư mục đã kiểm tra; chưa kiểm chứng hiệu năng, nhu cầu người dùng hay thời gian triển khai. Không nghiên cứu thị trường hoặc thư viện bên ngoài.

## Mục đích và bức tranh tổng thể

Ứng dụng giúp người dùng biểu diễn thông tin thành các thẻ (card) và quan hệ nối giữa chúng (relation). Thẻ chứa tóm tắt; panel bên phải chứa tài liệu chi tiết bằng Markdown và sơ đồ Mermaid. Nguồn nêu các trường hợp sử dụng như tài liệu kiến trúc, kiểm kê dự án và hiển thị dữ liệu do AI tạo; chưa xác định nhóm người dùng ưu tiên hoặc bằng chứng nhu cầu thực tế.

Người dùng tạo mới hoặc import file JSON, chỉnh sửa đồ thị, rồi export JSON để tiếp tục ở phiên sau. Dữ liệu chỉ tồn tại trong bộ nhớ trình duyệt; reload hoặc đóng tab làm mất trạng thái phiên. Đây là quyết định sản phẩm rõ ràng, đồng thời đặt trách nhiệm lưu file lên người dùng (mục 1, 23–35).

Đánh giá: dự án đáng triển khai thử nghiệm. Không có backend giúp giảm một phần công việc, nhưng trình biên tập đồ thị vẫn có độ phức tạp đáng kể ở tương tác, lịch sử chỉnh sửa và bảo toàn dữ liệu. Chưa đủ cơ sở để ước lượng lịch hoặc chi phí.

## Điểm mạnh

| Điểm mạnh | Giá trị | Nguồn |
|---|---|---|
| Thẻ tóm tắt, panel chi tiết | Hạn chế canvas trở thành trang tài liệu quá tải | 6, 10–17, 56 |
| Mô hình graph với cards và relations | Biểu diễn nhiều quan hệ, không bị giới hạn bởi cây | 8–9, 41–43 |
| JSON độc lập renderer | File dữ liệu không gắn trực tiếp với thư viện hiển thị | 2, 44 |
| Import có validation và lỗi có vị trí | Giúp sửa dữ liệu từ file, AI hoặc script | 25–27 |
| ID ổn định và version | Có nền tảng cho tương thích dữ liệu về sau | 51–53 |
| Không tài khoản, không upload dữ liệu | Phù hợp cách làm việc bằng file cục bộ | 34–35, 48 |

## Mâu thuẫn và điểm chưa chốt

| ID | Vấn đề | Hệ quả | Nguồn |
|---|---|---|---|
| C-01 | Mục 10 và 60 nói chọn/click card mở panel; mục 21 nói single click chỉ chọn, double click mới mở | Không có một quy tắc tương tác thống nhất | 10, 21, 60 |
| C-02 | Multi-select và keyboard shortcuts được mô tả như hành vi hỗ trợ, nhưng nằm trong V1.1 | Không rõ điều kiện nghiệm thu V1 | 5.1, 21, 45–46 |
| C-03 | Custom type đã được cho phép không giới hạn enum, nhưng V2 lại liệt kê Custom Card/Relation Types | Cần phân biệt chuỗi type tùy ý với chức năng quản lý template/type | 6.5, 42, 47 |
| W-01 | Template mục 30 có một card nhưng relation tham chiếu hai ID không tồn tại trong cards | Import template sẽ vi phạm validation tham chiếu nếu được dùng nguyên trạng | 26–27, 30 |
| Q-01 | Trường nào bắt buộc, default, giới hạn dữ liệu, unknown fields và version không hỗ trợ chưa được chốt | Chặn hợp đồng import/export ổn định | 27, 30, 41–43, 51 |
| Q-02 | Import thay thế hay gộp? Nếu project đang có thay đổi chưa export thì xử lý thế nào? | Có thể mất công việc hiện tại | 23–27 |
| Q-03 | Một thao tác undo là gì? Khi nào kết thúc chỉnh Markdown hoặc kéo card? | Lịch sử có thể quá vụn hoặc tốn bộ nhớ | 22, 40, 50 |
| Q-04 | Pan/zoom có làm dirty không, và export nào xóa dirty? | Viewport nằm trong file nhưng unsaved state chưa có ranh giới rõ | 23, 28, 40, 43 |
| Q-05 | Có cho self-loop, nhiều relation cùng cặp card, cycle, đổi endpoint không? Connector gắn vào phía nào? | Hành vi graph và cách lưu attachment chưa đầy đủ | 7–9, 17, 27, 42 |
| Q-06 | Focus theo chiều nào và bao nhiêu bước? Filter ẩn relation ra sao? | Ví dụ chưa đủ để suy ra thuật toán | 19–20 |
| Q-07 | Chưa chốt trình duyệt, desktop/mobile, khả năng dùng bàn phím và tiêu chí đo hiệu năng | Không thể nghiệm thu chất lượng chỉ bằng chữ “mượt” | 21, 55 |

W-01 là lỗi ví dụ có thể kiểm tra trực tiếp: `unique-card-id` không trùng `source-card-id` hoặc `target-card-id`. Template nên là project mẫu import được, hoặc được ghi rõ là tài liệu mô tả; schema máy đọc và ví dụ project là hai loại đầu ra khác nhau. Đây là đề xuất sửa, không phải quyết định đã được duyệt.

## Rủi ro cần ưu tiên

**Mất dữ liệu:** đúng với triết lý phiên làm việc trong nguồn, nhưng cần xử lý cả import thay thế và tạo project mới. Nên nghiệm thu cảnh báo rời trang trên các trình duyệt mục tiêu, thay vì xem đoạn thông báo mẫu là cam kết hành vi. Export Structure không chứa project hiện tại nên đề xuất không xóa dirty khi tải structure.

**Hai nguồn trạng thái:** nếu thư viện graph và application store cùng giữ bản dữ liệu độc lập, kéo thả hoặc undo có thể làm lệch nội dung export. Nên giữ một mô hình project chuẩn; selection, panel và history là trạng thái phiên riêng. Adapter ánh xạ dữ liệu renderer về mô hình chuẩn. Đây là diễn giải kỹ thuật từ mục 2 và 40, chưa có implementation để đánh giá.

**Nội dung import:** nguồn yêu cầu sanitize Markdown và hạn chế Mermaid (mục 54), nhưng chưa định nghĩa chính sách HTML, link, ảnh ngoài và lỗi cú pháp Mermaid. Cam kết privacy cần phân biệt không upload JSON với tài nguyên ngoài có thể được tải khi xem nội dung; đây là rủi ro cần kiểm chứng trong implementation, không phải hành vi đã quan sát.

**Hiệu năng:** mục tiêu 100–500 cards là mục tiêu nguồn, chưa là kết quả đo. Cần bộ dữ liệu kèm số relation, độ dài Markdown, sơ đồ Mermaid và máy/trình duyệt thử nghiệm. Đồ thị nhiều cạnh có thể khó đọc ngay cả khi thao tác vẫn nhanh.

## Lộ trình đề xuất

Đây là cách chia công việc để kiểm chứng, không thay thế scope V1 của nguồn.

1. Chốt JSON contract, sửa template và tạo fixture hợp lệ/không hợp lệ. Chốt click, import, dirty và đơn vị undo.
2. Xây một lát cắt hoàn chỉnh: import → hiển thị card/relation → sửa thẻ/Markdown → export → import lại. Chứng minh dữ liệu không mất và renderer không trở thành định dạng lưu trữ.
3. Hoàn thiện các mục Must Have trong mục 45: editors, Mermaid, resize panel, duplicate/delete, undo/redo và cảnh báo mất dữ liệu. Quyết định rõ connector-drop-to-create của mục 7.2 có thuộc V1 không.
4. Đo đồ thị mục tiêu, rồi làm V1.1. Với dữ liệu AI/indexer thiếu tọa độ, cần chốt đầu vào có bắt buộc position hay không; nếu có thì producer phải cung cấp, nếu không thì cần chính sách bố trí mặc định.

## Kiểm chứng nên có khi triển khai

- Import lỗi không làm thay đổi project đang mở; thông báo chỉ rõ đường dẫn trường.
- Export rồi import lại bảo toàn dữ liệu đã cam kết, có tính đến normalization/default được thống nhất.
- Xóa card loại bỏ relation liên quan; undo phục hồi đầy đủ cả hai.
- Kéo connector tạo card và relation là một thao tác có thể undo cùng nhau nếu được chốt như vậy.
- Title đổi không đổi ID; duplicate tạo ID mới và có chính sách relation rõ ràng.
- Markdown/Mermaid lỗi không làm sập editor; kiểm tra nội dung không an toàn theo chính sách đã chọn.
- Undo/redo và dirty phản ánh trạng thái đã export theo quy tắc được chốt; shortcut không phá thao tác nhập văn bản.

Các mục trên là đề xuất nghiệm thu, chưa phải kết quả test. Báo cáo đã đối chiếu các phát hiện với nguồn; chưa có stakeholder xác nhận các đề xuất. Chế độ QUICK không tạo HTML hoặc bản đồ tương tác; không có công thức nghiệp vụ cần tài liệu riêng. Không đồng bộ được business INDEX và tham chiếu AGENTS/CLAUDE vì bộ skill tại workspace thiếu script `scripts/business_context.py`.
