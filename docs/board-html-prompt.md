# Prompt tạo HTML tương thích với Board

Sao chép phần nằm giữa hai đường kẻ `---` vào ChatGPT (hoặc AI Agent khác), rồi điền khối **Yêu cầu nội dung** ở cuối. Prompt dùng lại được cho mọi chủ đề: chỉ cần thay khối đó, phần quy tắc giữ nguyên. Prompt khớp với editor HTML hiện tại của Board (định dạng `html-bs5`: HTML đã lọc + Bootstrap 5.3 có sẵn trong app, không cần mạng) và với **màn hình đọc** của Detail.

---

Hãy viết nội dung cho một note trong Board (Card Atlas) dưới dạng HTML tĩnh, đẹp và gọn, theo các quy tắc sau.

## 0. Tài liệu sẽ được hiển thị thế nào

Viết cho đúng màn hình đọc này, đừng tự dựng lại những gì nó đã có:

- **Mục lục tự động:** Board tự tạo mục lục dính bên lề từ mọi `h1`, `h2`, `h3` và đánh dấu mục đang đọc. Không tự viết mục lục, không đánh số trang, không thêm liên kết "về đầu trang".
- **Cột đọc:** chữ gốc 18px; đoạn văn và mục danh sách tự ngắt ở khoảng 72 ký tự mỗi dòng. Bảng, `row`, `card`, `pre` được dùng hết bề rộng cột (khoảng 1000px). Người đọc tự chỉnh cỡ chữ bằng nút A− / A+.
- **Hai theme sáng và tối:** cùng một HTML phải đọc tốt trên nền giấy sáng lẫn nền than tối. Vì vậy ưu tiên class Bootstrap tự đổi màu theo theme (mục C), tránh màu cố định.
- **Tiêu đề note** đã hiện ở thanh trên cùng của Detail; `h1` trong tài liệu là tiêu đề bài, viết ngắn.

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
   - Chữ: `lead` (đoạn mở đầu), `text-body-secondary` (chú thích phụ), `small`, `fw-bold`, `fst-italic`, `text-center`, `text-success`, `text-danger`, `text-primary`. Không làm mờ đoạn văn chính: `lead` và các `p` nội dung giữ màu chữ mặc định.
   - Khung ghi chú: `alert alert-info`, `alert alert-success`, `alert alert-warning`, `alert alert-danger`, `alert alert-secondary` (đặt trong `div`).
   - Thẻ: `card`, `card-body`, `card-title`, `card-header`, `card-text`.
   - Nhãn: `badge text-bg-primary`, `badge text-bg-success`, `badge text-bg-secondary`, `badge text-bg-warning`.
   - Danh sách: `list-group`, `list-group-item` (trên `ul`/`li`), `list-unstyled`.
   - Bảng: `table table-bordered table-sm`, thêm `table-striped` khi nhiều dòng; `thead` dùng `table-light`; nhãn cột/hàng dùng `th scope="col"` hoặc `scope="row"`.
   - Bố cục: `row g-3` chứa các `col-md-6` hoặc `col-md-4` để chia 2–3 cột trên màn rộng (tự xếp dọc khi hẹp). Không lồng quá 2 cấp `row`.
   - Khoảng cách: `mb-2`, `mb-3`, `mb-4`, `mt-3`, `mt-4`, `p-3`, `py-2`, `px-3`; viền/bo: `border`, `rounded`, `rounded-3`; nền nhạt: `bg-body-tertiary`.
   - Khối nhấn theo màu (tự đổi theo theme): nền `bg-success-subtle`, `bg-primary-subtle`, `bg-warning-subtle`, `bg-danger-subtle`, `bg-info-subtle`, `bg-secondary-subtle`; chữ đi kèm `text-success-emphasis`, `text-primary-emphasis`, `text-warning-emphasis`, `text-danger-emphasis`, `text-info-emphasis`, `text-secondary-emphasis`; viền `border-success-subtle`, `border-primary-subtle`… Luôn dùng nền `-subtle` cùng chữ `-emphasis` cùng màu.
   - Ảnh: `img-fluid rounded`. Trích dẫn: `blockquote` kèm `border-start border-3 ps-3 text-body-secondary`.
   - **Tránh vì không đổi theo theme tối:** `bg-light`, `bg-white`, `bg-dark`, `text-dark`, `text-black`, `text-white`, `text-light`, `text-muted`, `table-dark`, `text-bg-light`, `text-bg-dark`.
8. Mặc định **không dùng `style`**; class ở mục 7 đã đủ cho hầu hết tài liệu. Không đặt `font-size`, `font-family`, `width`/`max-width` bằng `px` cho đoạn văn (làm hỏng cột đọc và nút A− / A+). Nếu buộc phải dùng, chỉ các thuộc tính: `color`, `background-color`, `text-align`, `font-size`, `font-family`, `font-weight`, `font-style`, `text-decoration`, `margin` (và `-top/-right/-bottom/-left`), `padding` (và `-top/-right/-bottom/-left`), `width`, `max-width`, `height`, `border`, `border-radius`, `border-width`, `border-color`, `border-style`, `display`, `vertical-align`, `object-fit`. Giá trị đơn giản: màu hex (`#255c49`), `px`, `%`, `auto`, `solid`, `block`, `left`, `center`, `right`, `bold`, `normal`. Không dùng `/`, `!important`, `url()`, biến CSS, `line-height`, `position`, `flex`, `grid`, `float`, animation, `border-collapse`. Ngăn các khai báo bằng `;` **không có khoảng trắng sau dấu chấm phẩy** và không có `;` cuối: `style="color:#255c49;font-size:18px"`.
9. Màu hex chỉ là phương án cuối, vì màu cố định không đổi theo theme tối. Nếu dùng: nền nhạt `#e3f0e9`, `#e6eefb`, `#eee9fb`, `#fff2b0` **phải đi kèm màu chữ tối trong cùng `style`** (ví dụ `style="background-color:#e3f0e9;color:#255c49"`); không đặt riêng màu chữ tối (`#255c49`, `#2f5f8f`, `#6b4f9e`, `#b5651d`) trên nền mặc định. Không dùng quá 2–3 màu nhấn trong một note.

## D. Bố cục và thẩm mỹ

10. Khung chung: bọc toàn bộ trong một `article`; một `h1` duy nhất; ngay sau là một đoạn `lead` tóm tắt 1–2 câu (trả lời "đọc xong biết được gì"); rồi tới các mục.
11. Tiêu đề quyết định mục lục, nên:
    - `h2` cho mục lớn (nên 3–7 mục), `h3` cho mục con; không bỏ cấp.
    - Tiêu đề ngắn, dưới khoảng 50 ký tự, là cụm danh từ hoặc câu hỏi rõ nghĩa ("Khi nào dùng", "Lỗi hay gặp"), không lặp lại `h1`. Có thể đánh số mục lớn ("1. Khác biệt chính").
    - **Bên trong `card`, `alert`, ô bảng dùng `h4`–`h6`** (hoặc `p` có `fw-bold`), không dùng `h2`/`h3`, để mục lục không bị đầy các nhãn nhỏ.
    - Thêm `mt-4` cho `h2` khi mục trước kết thúc bằng bảng, card hoặc code.
12. Nhịp đọc: đoạn văn ngắn (2–4 câu), mỗi ý một `p` hoặc một `li`. Không viết ba đoạn văn liền nhau mà không có danh sách, bảng, khung hoặc ví dụ xen giữa. Không lạm dụng đậm; không viết HOA toàn câu.
13. Chọn đúng khối cho đúng việc:
    - Liệt kê → `ul`/`ol`; các bước làm → `ol`.
    - So sánh theo tiêu chí → bảng (tối đa khoảng 5 cột, ô ngắn).
    - Hai, ba khái niệm song song → `row g-3` với `col-md-6`/`col-md-4`, mỗi cột một `card`; thêm `h-100` cho `card` để các thẻ cao bằng nhau.
    - Ghi nhớ / lưu ý / lỗi hay gặp → `alert` (mỗi note tối đa 2–3 khung, mỗi khung mở bằng một nhãn `strong`).
    - Thuật ngữ, từ vựng → bảng 2–3 cột hoặc `list-group`.
    - Tóm tắt cuối bài → một `alert alert-success` hoặc danh sách ngắn dưới `h2` "Tóm tắt".
14. Code: dùng `<pre><code class="language-java">…</code></pre>`. Ngôn ngữ được tô màu: `java`, `javascript`, `typescript`, `json`, `xml`, `css`, `python`, `sql`, `bash`; ngôn ngữ khác dùng `language-text`. Mỗi khối code nên dưới 30 dòng và có một câu dẫn phía trên; tên hàm, lệnh, giá trị trong câu văn đặt trong `code`. Code dài quá 20.000 ký tự sẽ không được tô màu.
15. Bài tập và đáp án: đặt đáp án ở mục `h2` riêng, trình bày bằng danh sách thường (không dùng `details`).
16. Khung gợi ý theo loại tài liệu (chọn theo dòng **Loại** trong yêu cầu; tự điều chỉnh nếu nội dung cần):
    - **Bài học:** Ý chính → Giải thích → Ví dụ → Lỗi hay gặp → Luyện tập → Đáp án.
    - **So sánh:** Tóm tắt khác biệt → Bảng so sánh → Từng bên (card song song) → Khi nào dùng cái nào → Tóm tắt.
    - **Hướng dẫn:** Mục tiêu → Chuẩn bị → Các bước → Kiểm tra kết quả → Xử lý lỗi.
    - **Tra cứu / API:** Mục đích → Cú pháp hoặc request → Tham số (bảng) → Ví dụ → Lỗi thường gặp.
    - **Ghi chú / tổng kết:** Bối cảnh → Nội dung chính → Kết luận → Việc tiếp theo.
17. Viết bằng ngôn ngữ nêu trong yêu cầu. Nội dung phải chính xác, không bịa số liệu hay nguồn.

## E. Ví dụ đúng chuẩn (đã kiểm tra với bộ lọc của Board)

Ví dụ 1 — bài học có khung ghi nhớ, bảng và bài tập:

```html
<article><h1>Đuôi -s/-es</h1><p class="lead">Thêm -s hoặc -es sau danh từ số nhiều và động từ ngôi thứ ba số ít ở thì hiện tại đơn.</p><div class="alert alert-info"><strong>Ghi nhớ:</strong> động từ có chủ ngữ <em>he, she, it</em> luôn thêm -s/-es.</div><h2>Công thức</h2><table class="table table-bordered table-sm"><thead class="table-light"><tr><th scope="col">Trường hợp</th><th scope="col">Cách thêm</th><th scope="col">Ví dụ</th></tr></thead><tbody><tr><td>Từ thường</td><td>+ s</td><td>book → books</td></tr><tr><td>Tận cùng s, x, z, ch, sh</td><td>+ es</td><td>watch → watches</td></tr><tr><td>Phụ âm + y</td><td>y → ies</td><td>study → studies</td></tr></tbody></table><h2>Luyện tập</h2><ol><li>She (watch) ___ TV every evening.</li><li>Two (box) ___ are on the table.</li></ol><h2>Đáp án</h2><ol><li>watches</li><li>boxes</li></ol></article>
```

Ví dụ 2 — so sánh: hai `card` song song (tiêu đề trong card là `h5`), khối nhấn tự đổi theo theme:

```html
<article><h1>So sánh /s/ và /z/</h1><p class="lead">Cách đọc đuôi -s phụ thuộc vào âm cuối của từ gốc.</p><h2>Hai cách đọc</h2><div class="row g-3"><div class="col-md-6"><div class="card h-100"><div class="card-body"><h5 class="card-title">/s/ <span class="badge text-bg-success">vô thanh</span></h5><p class="card-text mb-0">Sau /p/, /t/, /k/, /f/: books, cats, cups.</p></div></div></div><div class="col-md-6"><div class="card h-100"><div class="card-body"><h5 class="card-title">/z/ <span class="badge text-bg-primary">hữu thanh</span></h5><p class="card-text mb-0">Sau nguyên âm và âm hữu thanh: dogs, days, pens.</p></div></div></div></div><h2 class="mt-4">Lỗi hay gặp</h2><div class="alert alert-warning"><strong>Lưu ý:</strong> không đọc mọi đuôi -s thành /s/.</div><h2>Tóm tắt</h2><div class="p-3 rounded border border-success-subtle bg-success-subtle text-success-emphasis">Âm cuối vô thanh → /s/. Âm cuối hữu thanh hoặc nguyên âm → /z/.</div></article>
```

Ví dụ 3 — bài có code:

```html
<article><h1>Biến và kiểu dữ liệu trong Java</h1><p class="lead">Mỗi biến có một kiểu cố định, được khai báo trước khi dùng.</p><h2>Khai báo</h2><p>Viết kiểu trước, tên biến sau, rồi gán giá trị:</p><pre><code class="language-java">int age = 20;
String name = "An";
double price = 9.5;</code></pre><ul class="list-group mb-3"><li class="list-group-item"><code>int</code>: số nguyên</li><li class="list-group-item"><code>String</code>: chuỗi ký tự</li><li class="list-group-item"><code>double</code>: số thực</li></ul><h2>Ghi nhớ</h2><div class="alert alert-success mb-0">Đặt tên biến theo camelCase, bắt đầu bằng chữ thường.</div></article>
```

## F. Tự kiểm tra trước khi trả lời

- Mọi thẻ, thuộc tính, class và thuộc tính CSS đều nằm trong danh sách trên; thứ gì không có thì bỏ, không tự bổ sung tính năng.
- Đúng một `h1`, có `lead`, các mục là `h2`/`h3` ngắn gọn; không có `h2`/`h3` trong `card`, `alert` hay bảng; không có mục lục tự viết.
- Không còn `bg-light`, `text-muted`, `text-dark`, `bg-white`; không có màu chữ hex đặt riêng trên nền mặc định; không có `font-size` hay `width` bằng `px` trên đoạn văn.
- Không có ba đoạn văn liền nhau; mỗi khối code có câu dẫn.

**Yêu cầu nội dung của tôi:**

- Chủ đề: [ví dụ: Authentication và Authorization trong Spring Boot]
- Loại: [Bài học | So sánh | Hướng dẫn | Tra cứu / API | Ghi chú / tổng kết]
- Người đọc: [ví dụ: lập trình viên backend mới, đã biết Java cơ bản]
- Mục tiêu: [đọc xong làm được gì]
- Ngôn ngữ: [Tiếng Việt | English | song ngữ]
- Độ dài: [ngắn ~300 từ | vừa ~700 từ | dài ~1500 từ]
- Bắt buộc có: [ví dụ: bảng so sánh, một ví dụ code Java, 5 câu luyện tập có đáp án]
- Ghi chú thêm: [nguồn, thuật ngữ cần giữ nguyên, điều cần tránh]

---

## Cách dùng kết quả trong Board

1. Mở note, vào editor HTML, chọn **Nhập HTML**, dán đoạn HTML (tối đa 1 MB) rồi bấm **Kiểm tra HTML**.
2. Đọc danh sách "Phần không hỗ trợ hoặc không an toàn đã loại" và bản xem trước. Nếu có phần bị loại hoặc bố cục chưa đẹp, gửi lại cho ChatGPT câu sau kèm danh sách đó: *"Board đã loại các phần sau: […]. Hãy sửa đúng những phần này theo quy tắc ở trên, giữ nguyên nội dung và cấu trúc còn lại, trả về toàn bộ HTML."*
3. Bấm **Thêm nội dung đã kiểm tra**, rồi **Áp dụng** trong Detail để lưu vào note.
4. Mở tab đọc của Detail, bật thử theme tối (nút ◐) và xem mục lục bên lề: nếu mục lục quá dài hoặc có khối khó đọc ở theme tối, yêu cầu ChatGPT sửa theo mục 7, 9 và 11.

Để tạo nhiều note cùng phong cách trong một cuộc trò chuyện, dán prompt một lần rồi mỗi lần chỉ gửi lại khối **Yêu cầu nội dung** mới.

Quy tắc trên phản ánh bộ hỗ trợ hiện tại (xem `assets/js/graph/html-document.js` và `assets/js/detail/html-content.js`); không đảm bảo mọi kết quả do mô hình tạo đều hợp lệ, nên luôn kiểm tra bước "Kiểm tra HTML" trước khi thêm. Bootstrap được nạp cục bộ từ `assets/vendor/bootstrap.min.css` (v5.3.8); các component cần JavaScript của Bootstrap không hoạt động trong Board. Kiểu chữ, cột đọc và theme tối của tài liệu nằm ở `assets/css/document-content.css`.
