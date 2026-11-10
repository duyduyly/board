# Prompt tạo HTML tương thích với Board

Sao chép phần nằm giữa hai đường kẻ `---` vào ChatGPT, rồi thay dòng **Yêu cầu nội dung** ở cuối. Prompt này khớp với editor HTML hiện tại của Board (định dạng `html-bs5`: HTML đã lọc + Bootstrap 5.3 có sẵn trong app, không cần mạng).

---

Hãy viết nội dung cho một note trong Board (Card Atlas) dưới dạng HTML tĩnh, đẹp và gọn, theo các quy tắc sau.

## A. Định dạng trả lời

1. Chỉ trả về HTML, không dùng Markdown code fence, không lời giải thích. Không tạo `html`, `head`, `body`, `style`, `script`, `link`, `meta`. Không chèn bình luận HTML.
2. Giữ cấu trúc hợp lệ: thẻ lồng đúng và đóng đầy đủ; dùng `&amp;`, `&lt;`, `&gt;` cho ký tự đặc biệt trong văn bản. Tối đa 3000 phần tử, lồng sâu tối đa 32 cấp, tổng chữ dưới 100.000 ký tự (nên ngắn hơn nhiều).

## B. Thẻ và thuộc tính được hỗ trợ

3. Chỉ dùng các thẻ: `article`, `section`, `aside`, `header`, `footer`, `div`, `p`, `h1`–`h6`, `span`, `strong`, `b`, `em`, `i`, `u`, `s`, `sub`, `sup`, `br`, `hr`, `ul`, `ol`, `li`, `blockquote`, `pre`, `code`, `table`, `caption`, `thead`, `tbody`, `tfoot`, `tr`, `th`, `td`, `figure`, `figcaption`, `img`, `a`. Không dùng `details`, `summary`, `button`, `input`, `form`, `iframe`, `svg`, `video`, `audio`, `canvas`, `style`, `script`.
4. Chỉ dùng các thuộc tính: `class`, `style`, `href`, `src`, `alt`, `title`, `colspan`, `rowspan`, `start`, `scope`, `width`, `height`. Không dùng `id`, `data-*`, `aria-*`, `role`, `onclick` hay bất kỳ sự kiện nào.
5. Liên kết `href` chỉ là `https://`, `http://`, `mailto:` hoặc bắt đầu bằng `#`. Ảnh `img` chỉ dùng `src` là URL `https://` hoặc `http://` có thật, kèm `alt` mô tả; **không tự bịa URL ảnh** (nếu không có URL thật thì bỏ ảnh). Ảnh URL cần mạng và có thể bị nguồn chặn.

## C. Làm đẹp bằng Bootstrap 5.3 (ưu tiên class, hạn chế style)

6. Dùng class Bootstrap 5.3 để trình bày. Class chỉ gồm chữ, số, `-`, `_`. Chỉ dùng component **không cần JavaScript**. Không dùng accordion, collapse, modal, tooltip, popover, dropdown, tab, carousel, navbar, offcanvas, toast.
7. Bộ class nên dùng:
   - Chữ: `lead` (đoạn mở đầu), `text-muted`, `small`, `fw-bold`, `fst-italic`, `text-center`, `text-success`, `text-danger`, `text-primary`.
   - Khung ghi chú: `alert alert-info`, `alert alert-success`, `alert alert-warning`, `alert alert-danger`, `alert alert-secondary` (đặt trong `div`).
   - Thẻ: `card`, `card-body`, `card-title`, `card-header`, `card-text`.
   - Nhãn: `badge text-bg-primary`, `badge text-bg-success`, `badge text-bg-secondary`, `badge text-bg-warning`.
   - Danh sách: `list-group`, `list-group-item` (trên `ul`/`li`), `list-unstyled`.
   - Bảng: `table table-bordered table-sm`, thêm `table-striped` khi nhiều dòng; `thead` dùng `table-light`; nhãn cột/hàng dùng `th scope="col"` hoặc `scope="row"`.
   - Bố cục: `row g-3` chứa các `col-md-6` hoặc `col-md-4` để chia 2–3 cột trên màn rộng (tự xếp dọc khi hẹp). Không lồng quá 2 cấp `row`.
   - Khoảng cách: `mb-2`, `mb-3`, `mb-4`, `mt-3`, `p-3`, `py-2`, `px-3`; viền/bo: `border`, `rounded`, `rounded-3`; nền nhạt: `bg-light`.
   - Ảnh: `img-fluid rounded`. Trích dẫn: `blockquote` kèm `border-start border-3 ps-3 text-muted`.
8. Chỉ dùng `style` khi thật cần (ví dụ một màu nhấn). Nếu dùng, chỉ các thuộc tính: `color`, `background-color`, `text-align`, `font-size`, `font-family`, `font-weight`, `font-style`, `text-decoration`, `margin` (và `-top/-right/-bottom/-left`), `padding` (và `-top/-right/-bottom/-left`), `width`, `max-width`, `height`, `border`, `border-radius`, `border-width`, `border-color`, `border-style`, `display`, `vertical-align`, `object-fit`. Giá trị đơn giản: màu hex (`#255c49`), `px`, `%`, `auto`, `solid`, `block`, `left`, `center`, `right`, `bold`, `normal`. Không dùng `/`, `!important`, `url()`, biến CSS, `line-height`, `position`, `flex`, `grid`, `float`, animation, `border-collapse`. Ngăn các khai báo bằng `;` **không có khoảng trắng sau dấu chấm phẩy** và không có `;` cuối: `style="color:#255c49;font-size:18px"`.
9. Bảng màu nhấn hợp với Board (chỉ dùng khi cần màu riêng): xanh lá `#255c49`, xanh dương `#2f5f8f`, tím `#6b4f9e`, cam `#b5651d`, nền nhạt `#e3f0e9`, `#e6eefb`, `#eee9fb`, `#fff2b0`. Giữ chữ đủ tương phản với nền; không dùng quá 2–3 màu nhấn trong một note.

## D. Bố cục và thẩm mỹ

10. Cấu trúc gọn: bọc toàn bộ trong một `article`; một `h1` duy nhất (tiêu đề note), sau đó là đoạn `lead` tóm tắt 1–2 câu; mỗi mục lớn là `h2`, mục con là `h3`; không bỏ cấp tiêu đề.
11. Đoạn văn ngắn (2–4 câu), mỗi ý một `p` hoặc một `li`. Dùng `ul`/`ol` cho liệt kê, bảng cho so sánh, khung `alert` cho **ghi nhớ / lưu ý / lỗi hay gặp** (mỗi note tối đa 2–3 khung), thẻ `card` hoặc `row` cho các phần song song. Không lạm dụng đậm; không viết HOA toàn câu.
12. Code: dùng `<pre><code class="language-java">…</code></pre>`. Ngôn ngữ được tô màu: `java`, `javascript`, `typescript`, `json`, `xml`, `css`, `python`, `sql`, `bash`; ngôn ngữ khác dùng `language-text`. Code dài quá 20.000 ký tự sẽ không được tô màu.
13. Bài tập và đáp án: đặt đáp án ở mục `h2` riêng, trình bày bằng danh sách thường (không dùng `details`).
14. Viết bằng ngôn ngữ của yêu cầu bên dưới. Nội dung phải chính xác, không bịa số liệu hay nguồn.

## E. Ví dụ đúng chuẩn (đã kiểm tra với bộ lọc của Board)

Ví dụ 1 — bài học có khung ghi nhớ, bảng và bài tập:

```html
<article><h1>Đuôi -s/-es</h1><p class="lead">Thêm -s hoặc -es sau danh từ số nhiều và động từ ngôi thứ ba số ít ở thì hiện tại đơn.</p><div class="alert alert-info"><strong>Ghi nhớ:</strong> động từ có chủ ngữ <em>he, she, it</em> luôn thêm -s/-es.</div><h2>Công thức</h2><table class="table table-bordered table-sm"><thead class="table-light"><tr><th scope="col">Trường hợp</th><th scope="col">Cách thêm</th><th scope="col">Ví dụ</th></tr></thead><tbody><tr><td>Từ thường</td><td>+ s</td><td>book → books</td></tr><tr><td>Tận cùng s, x, z, ch, sh</td><td>+ es</td><td>watch → watches</td></tr><tr><td>Phụ âm + y</td><td>y → ies</td><td>study → studies</td></tr></tbody></table><h2>Luyện tập</h2><ol><li>She (watch) ___ TV every evening.</li><li>Two (box) ___ are on the table.</li></ol><h2>Đáp án</h2><ol><li>watches</li><li>boxes</li></ol></article>
```

Ví dụ 2 — hai cột song song bằng thẻ `card`, kèm nhãn:

```html
<article><h1>So sánh /s/ và /z/</h1><p class="lead">Cách đọc đuôi -s phụ thuộc vào âm cuối của từ gốc.</p><div class="row g-3"><div class="col-md-6"><div class="card"><div class="card-body"><h3 class="card-title">/s/ <span class="badge text-bg-success">vô thanh</span></h3><p class="card-text mb-0">Sau /p/, /t/, /k/, /f/: books, cats, cups.</p></div></div></div><div class="col-md-6"><div class="card"><div class="card-body"><h3 class="card-title">/z/ <span class="badge text-bg-primary">hữu thanh</span></h3><p class="card-text mb-0">Sau nguyên âm và âm hữu thanh: dogs, days, pens.</p></div></div></div></div><div class="alert alert-warning mt-3"><strong>Lỗi hay gặp:</strong> không đọc mọi đuôi -s thành /s/.</div></article>
```

Ví dụ 3 — bài có code:

```html
<article><h1>Biến và kiểu dữ liệu trong Java</h1><p class="lead">Mỗi biến có một kiểu cố định, được khai báo trước khi dùng.</p><h2>Khai báo</h2><pre><code class="language-java">int age = 20;
String name = "An";
double price = 9.5;</code></pre><ul class="list-group mb-3"><li class="list-group-item"><code>int</code>: số nguyên</li><li class="list-group-item"><code>String</code>: chuỗi ký tự</li><li class="list-group-item"><code>double</code>: số thực</li></ul><div class="alert alert-success mb-0">Đặt tên biến theo camelCase, bắt đầu bằng chữ thường.</div></article>
```

Trước khi trả lời, tự kiểm tra từng thẻ, thuộc tính, class và thuộc tính CSS theo danh sách trên; bỏ mọi thứ không có trong danh sách thay vì giữ lại. Không tự bổ sung tính năng ngoài danh sách.

**Yêu cầu nội dung của tôi:** [Điền chủ đề, đối tượng đọc, độ dài và bố cục mong muốn.]

---

## Cách dùng kết quả trong Board

1. Mở note, vào editor HTML, chọn **Nhập HTML**, dán đoạn HTML (tối đa 1 MB) rồi bấm **Kiểm tra HTML**.
2. Đọc danh sách "Phần không hỗ trợ hoặc không an toàn đã loại" và bản xem trước. Nếu có phần bị loại hoặc bố cục chưa đẹp, dán lại danh sách đó cho ChatGPT và yêu cầu sửa đúng phần nêu.
3. Bấm **Thêm nội dung đã kiểm tra**, rồi **Áp dụng** trong Detail để lưu vào note.

Quy tắc trên phản ánh bộ hỗ trợ hiện tại (xem `assets/js/graph/html-document.js` và `assets/js/detail/html-content.js`); không đảm bảo mọi kết quả do mô hình tạo đều hợp lệ, nên luôn kiểm tra bước "Kiểm tra HTML" trước khi thêm. Bootstrap được nạp cục bộ từ `assets/vendor/bootstrap.min.css` (v5.3.8); các component cần JavaScript của Bootstrap không hoạt động trong Board.
