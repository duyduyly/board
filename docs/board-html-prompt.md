# Prompt tạo HTML tương thích với Board

Sao chép nội dung dưới đây vào ChatGPT và thay phần yêu cầu ở cuối.

---

Hãy tạo một đoạn HTML tĩnh cho Visual Card Graph Editor (Board) theo các quy tắc sau:

1. Chỉ trả về HTML, không dùng Markdown code fence hay lời giải thích. Không tạo `html`, `head`, `body`, `style` hoặc `script`.
2. Chỉ dùng các thẻ: `article`, `section`, `aside`, `header`, `footer`, `div`, `p`, `h1`, `h2`, `h3`, `h4`, `h5`, `h6`, `span`, `strong`, `b`, `em`, `i`, `u`, `s`, `sub`, `sup`, `br`, `hr`, `ul`, `ol`, `li`, `blockquote`, `pre`, `code`, `table`, `caption`, `thead`, `tbody`, `tfoot`, `tr`, `th`, `td`, `figure`, `figcaption`, `img`, `a`. Không dùng `details` hoặc `summary`; trình bày đáp án thành mục văn bản thông thường.
3. Không dùng JavaScript, sự kiện như `onclick`, biểu mẫu, iframe, SVG, font ngoài hay thư viện ngoài. Không dùng class để tránh phụ thuộc stylesheet bên ngoài.
4. Chỉ dùng CSS trong thuộc tính `style`, với các thuộc tính: `color`, `background-color`, `text-align`, `font-size`, `font-family`, `font-weight`, `font-style`, `text-decoration`, `margin`, `margin-top`, `margin-right`, `margin-bottom`, `margin-left`, `padding`, `padding-top`, `padding-right`, `padding-bottom`, `padding-left`, `width`, `max-width`, `height`, `border`, `border-radius`, `border-width`, `border-color`, `border-style`, `display`, `vertical-align`.
5. Giá trị CSS phải đơn giản: màu hex, số đo `px` hoặc `%`, `auto`, `solid`, `block`, `left`, `center`, `right`, `bold`, `normal`, `Arial`, `sans-serif`. Không dùng dấu `/`, `!important`, `url()`, biến CSS hay `calc()`. Không dùng `font`, `background`, `line-height`, `border-left`, `border-top`, `border-collapse`, `overflow-x`, `cursor`, `position`, flexbox, grid hoặc animation.
6. Trong mỗi `style`, ngăn các khai báo bằng `;` **không có khoảng trắng sau dấu chấm phẩy**, và không thêm `;` cuối. Ví dụ: `style="color:#333;font-size:16px;margin:0 0 12px"`.
7. Chỉ dùng liên kết `https://`, `http://`, `mailto:` hoặc bắt đầu bằng `#`. Nếu yêu cầu ảnh, có thể dùng `img` với `src` là URL `https://` hoặc `http://` hợp lệ và `alt` mô tả ảnh; không tự bịa URL ảnh. Ảnh URL cần mạng và có thể bị nguồn chặn. Giữ bảng gọn, không đặt chiều rộng cố định lớn để dễ đọc trên màn hình nhỏ.
8. Giữ cấu trúc hợp lệ, các thẻ lồng đúng và đóng đầy đủ. Không chèn bình luận HTML. Dùng ký tự `&amp;`, `&lt;`, `&gt;` khi cần biểu diễn các ký tự đặc biệt trong văn bản.

Ví dụ cấu trúc hợp lệ:

```html
<article style="max-width:800px;margin:auto;padding:20px;color:#333;font-family:Arial,sans-serif"><h1 style="font-size:28px;margin:0 0 12px">Tiêu đề</h1><p>Nội dung <strong>quan trọng</strong>.</p><div style="background-color:#eef5ff;padding:14px;border:1px solid #4285f4"><strong>Ghi nhớ:</strong> Một ghi chú ngắn.</div><h2>Ví dụ</h2><table style="width:100%;font-size:14px"><thead><tr><th style="border:1px solid #ddd;padding:8px">Quy tắc</th><th style="border:1px solid #ddd;padding:8px">Ví dụ</th></tr></thead><tbody><tr><td style="border:1px solid #ddd;padding:8px">Thêm s</td><td style="border:1px solid #ddd;padding:8px">book → books</td></tr></tbody></table><h2>Bài tập</h2><ol><li>Điền câu trả lời.</li></ol><h2>Đáp án</h2><p>Câu trả lời ở đây.</p></article>
```

Trước khi trả lời, tự kiểm tra lại từng thẻ và từng thuộc tính CSS theo danh sách trên. Không tự bổ sung tính năng ngoài danh sách.

**Yêu cầu nội dung của tôi:** [Điền chủ đề, đối tượng đọc, độ dài và bố cục mong muốn.]

---

Sau khi nhận kết quả, dùng chức năng nhập HTML và xem trước trong Board. Kiểm tra cảnh báo và bản xem trước trước khi chèn; nếu có cảnh báo, yêu cầu ChatGPT sửa phần được nêu. Quy tắc này phản ánh bộ hỗ trợ hiện tại, không đảm bảo mọi kết quả do mô hình tạo đều hợp lệ.
