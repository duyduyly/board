# Prompt tạo HTML tương thích với Board

Sao chép phần nằm giữa hai đường kẻ `---` vào ChatGPT (hoặc AI Agent khác), rồi điền khối **Yêu cầu nội dung** ở cuối. Prompt dùng lại được cho mọi chủ đề: chỉ cần thay khối đó, phần quy tắc giữ nguyên. Prompt khớp với editor HTML hiện tại của Board (định dạng `html-bs5`: HTML đã lọc + Bootstrap 5.3 có sẵn trong app, không cần mạng) và với **màn hình đọc** của Detail, nơi sơ đồ Mermaid được vẽ, video YouTube phát được và ảnh base64 dán vào được lưu thành tệp đính kèm.

---

Hãy viết nội dung cho một note trong Board (Card Atlas) dưới dạng HTML tĩnh, đẹp và gọn, theo các quy tắc sau.

## 0. Tài liệu sẽ được hiển thị thế nào

Viết cho đúng màn hình đọc này, đừng tự dựng lại những gì nó đã có:

- **Mục lục tự động:** Board tự tạo mục lục dính bên lề từ mọi `h1`, `h2`, `h3` và đánh dấu mục đang đọc. Không tự viết mục lục, không đánh số trang, không thêm liên kết "về đầu trang".
- **Cột đọc:** chữ gốc 18px; đoạn văn và mục danh sách tự ngắt ở khoảng 72 ký tự mỗi dòng. Bảng, `row`, `card`, `pre` được dùng hết bề rộng cột (khoảng 1000px). Người đọc tự chỉnh cỡ chữ bằng nút A− / A+.
- **Hai theme sáng và tối:** cùng một HTML phải đọc tốt trên nền giấy sáng lẫn nền than tối. Vì vậy ưu tiên class Bootstrap tự đổi màu theo theme (mục C), tránh màu cố định.
- **Sơ đồ và video:** khối Mermaid được vẽ thành sơ đồ theo màu của theme; liên kết video YouTube thành khung phát, chỉ tải khi người đọc bấm (mục 19).
- **Tiêu đề note** đã hiện ở thanh trên cùng của Detail; `h1` trong tài liệu là tiêu đề bài, viết ngắn.

## A. Định dạng trả lời

1. Chỉ trả về HTML, không dùng Markdown code fence, không lời giải thích. Không tạo `html`, `head`, `body`, `style`, `script`, `link`, `meta`. Không chèn bình luận HTML.
2. Giữ cấu trúc hợp lệ: thẻ lồng đúng và đóng đầy đủ; dùng `&amp;`, `&lt;`, `&gt;` cho ký tự đặc biệt trong văn bản. Tối đa 3000 phần tử, lồng sâu tối đa 32 cấp, tổng chữ dưới 100.000 ký tự (nên ngắn hơn nhiều).

## B. Thẻ và thuộc tính được hỗ trợ

3. Chỉ dùng các thẻ: `article`, `section`, `aside`, `header`, `footer`, `div`, `p`, `h1`–`h6`, `span`, `strong`, `b`, `em`, `i`, `u`, `s`, `sub`, `sup`, `br`, `hr`, `ul`, `ol`, `li`, `blockquote`, `pre`, `code`, `table`, `caption`, `thead`, `tbody`, `tfoot`, `tr`, `th`, `td`, `figure`, `figcaption`, `img`, `a`. Không dùng `details`, `summary`, `button`, `input`, `form`, `iframe`, `svg`, `video`, `audio`, `canvas`, `style`, `script`. Sơ đồ viết bằng mã Mermaid trong `pre > code`, video viết bằng một liên kết `a` có class `board-video` (mục 19); không tự nhúng `iframe` hay `video`.
4. Chỉ dùng các thuộc tính: `class`, `style`, `href`, `src`, `alt`, `title`, `colspan`, `rowspan`, `start`, `scope`, `width`, `height`. Không dùng `id`, `data-*`, `aria-*`, `role`, `onclick` hay bất kỳ sự kiện nào.
5. Liên kết `href` chỉ là `https://`, `http://`, `mailto:` hoặc bắt đầu bằng `#`. Ảnh `img` chỉ dùng `src` là URL `https://` hoặc `http://` có thật, hoặc chuỗi `data:image/…;base64,…` do người dùng đưa (mục 19), kèm `alt` mô tả; **không tự bịa URL ảnh** (nếu không có ảnh thật thì bỏ ảnh). Ảnh URL cần mạng và có thể bị nguồn chặn.

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
   - Sơ đồ (mục 19): `d-flex`, `flex-wrap`, `align-items-center`, `gap-2`, `fs-3`, `fs-4`, `me-2`, `h-100`.
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
    - Quy trình, luồng, quan hệ, trước và sau → sơ đồ Mermaid hoặc sơ đồ dựng bằng khối HTML (mục 19).
    - So sánh theo tiêu chí → bảng (tối đa khoảng 5 cột, ô ngắn).
    - Hai, ba khái niệm song song → `row g-3` với `col-md-6`/`col-md-4`, mỗi cột một `card`; thêm `h-100` cho `card` để các thẻ cao bằng nhau.
    - Ghi nhớ / lưu ý / lỗi hay gặp → `alert` (mỗi note tối đa 3–4 khung, mỗi khung mở bằng một nhãn `strong`).
    - Thuật ngữ, từ vựng → bảng 2–3 cột hoặc `list-group`.
    - Tóm tắt cuối bài → một `alert alert-success` hoặc danh sách ngắn dưới `h2` "Tóm tắt".
14. Code: dùng `<pre><code class="language-java">…</code></pre>`. Ngôn ngữ được tô màu: `java`, `javascript`, `typescript`, `json`, `xml`, `css`, `python`, `sql`, `bash`; ngôn ngữ khác dùng `language-text`; `language-mermaid` chỉ dành cho sơ đồ (mục 19), không dùng để trình bày mã Mermaid như code. Mỗi khối code nên dưới 30 dòng và có một câu dẫn phía trên; tên hàm, lệnh, giá trị trong câu văn đặt trong `code`. Code dài quá 20.000 ký tự sẽ không được tô màu.
15. Bài tập và đáp án: đặt đáp án ở mục `h2` riêng, trình bày bằng danh sách thường (không dùng `details`).
16. Khung gợi ý theo loại tài liệu (chọn theo dòng **Loại** trong yêu cầu; tự điều chỉnh nếu nội dung cần):
    - **Bài học ngắn / Bài học dài:** dùng đúng mẫu 5W1H ở mục 18.
    - **So sánh:** Tóm tắt khác biệt → Bảng so sánh → Từng bên (card song song) → Khi nào dùng cái nào → Tóm tắt.
    - **Hướng dẫn:** Mục tiêu → Chuẩn bị → Các bước → Kiểm tra kết quả → Xử lý lỗi.
    - **Tra cứu / API:** Mục đích → Cú pháp hoặc request → Tham số (bảng) → Ví dụ → Lỗi thường gặp.
    - **Ghi chú / tổng kết:** Bối cảnh → Nội dung chính → Kết luận → Việc tiếp theo.
17. Viết bằng ngôn ngữ nêu trong yêu cầu. Nội dung phải chính xác, không bịa số liệu hay nguồn.
18. Mẫu bài học 5W1H. Một bài học phải trả lời đủ sáu câu hỏi: **What** (là gì), **Why** (vì sao cần), **Who** (ai dùng), **When** (khi nào), **Where** (ở đâu, trong ngữ cảnh nào), **How** (làm thế nào). Giữ đúng thứ tự mục và giới hạn độ dài của mẫu; tên mục viết lại cho hợp chủ đề, không ghi chữ "What", "Why" vào tiêu đề. Who và Where gộp vào mục "Khi nào dùng"; nếu không có gì đáng nói thì bỏ, không viết cho đủ chỗ.

    **Phạm vi: một note, một vấn đề.** Bài chỉ trả lời một câu hỏi chính, nêu ở `lead`. Nếu chủ đề cần hơn 5 bước, hơn 5 thuật ngữ hoặc vượt giới hạn từ của mẫu, chỉ viết phần cốt lõi và liệt kê các phần còn lại ở dòng "Nên tách thành note riêng" trong khối Liên quan; không viết dài thêm.

    **Mẫu ngắn** (khoảng 400–500 từ, đọc trong 3 phút, 6 mục `h2`):

    | Thứ tự | Khối | Trả lời | Trình bày | Giới hạn |
    |---|---|---|---|---|
    | 1 | `h1` + `lead` | What | Một câu "X là …, dùng để …" | 1–2 câu |
    | 2 | Khung "Hình dung" | What | `alert alert-info`: một ví von đời thường | 1–2 câu |
    | 3 | `h2` Vì sao cần | Why | Một tình huống cụ thể, rồi lợi ích | 2–3 câu |
    | 4 | `h2` Khi nào dùng | When, Who, Where | `ul`, rồi `h3` "Dễ nhầm với …" kèm bảng so với một khái niệm gần nhất | 2–3 dòng; bảng 2–3 hàng |
    | 5 | `h2` Cách làm | How | Một sơ đồ (mục 19) hoặc `ol` các bước, kèm đúng một ví dụ; video nếu yêu cầu có | 3–5 bước |
    | 6 | `h2` Ghi nhớ | Tổng kết | `alert alert-warning` cho một lỗi hay gặp (sai → đúng), rồi `alert alert-success` có `ul` | 1 lỗi, 3 dòng |
    | 7 | `h2` Tự kiểm tra | Nhớ lại | `ol` câu hỏi | 2–3 câu |
    | 8 | `h2` Đáp án | Nhớ lại | `ol`, mỗi đáp án một dòng | Bằng số câu hỏi |
    | 9 | Khối Liên quan | Nối note | `footer` (xem dưới) | 1–3 dòng |

    **Mẫu dài** (khoảng 1000–1300 từ, đọc trong 7–9 phút, 8–9 mục `h2`):

    | Thứ tự | Khối | Trả lời | Trình bày | Giới hạn |
    |---|---|---|---|---|
    | 1 | `h1` + `lead` | What | Một câu định nghĩa và một câu "đọc xong làm được gì" | 2 câu |
    | 2 | Khung "Nhìn nhanh" | What, When, How | `div` có `p-3 rounded border bg-body-tertiary` chứa `ul` ba dòng: là gì, dùng khi nào, cách làm | 3 dòng, không có `h2` |
    | 3 | `h2` Vì sao cần | Why | Mở bằng một tình huống hoặc vấn đề thật, rồi điều gì xảy ra nếu thiếu | 2 đoạn ngắn |
    | 4 | `h2` Là gì | What | Định nghĩa, một ví von trong `alert alert-info`, một sơ đồ khái niệm (mục 19), thuật ngữ trong bảng hoặc `list-group` | Tối đa 5 thuật ngữ |
    | 5 | `h2` Khi nào dùng | When, Who, Where | Hai `card` song song "Nên dùng / Không nên dùng" | 3–4 dòng mỗi bên |
    | 6 | `h2` Dễ nhầm với | What | Bảng so với 1–2 khái niệm gần nhất theo 3–4 tiêu chí, kết bằng một câu "chọn cái nào khi nào" | 3–4 hàng |
    | 7 | `h2` Cách làm | How | Một sơ đồ luồng tổng quan (mục 19), rồi mỗi bước một `h3`: một câu giải thích và một ví dụ nhỏ | 3–5 bước |
    | 8 | `h2` Ví dụ hoàn chỉnh | How | Một ví dụ đi từ đầu đến cuối, có câu dẫn | 1 ví dụ |
    | 9 | `h2` Lỗi hay gặp | How | Bảng "Sai / Đúng / Vì sao" | 2–4 hàng |
    | 10 | `h2` Tóm tắt | Tổng kết | `alert alert-success` có `ul` | 3–5 dòng |
    | 11 | `h2` Tự kiểm tra | Nhớ lại | `ol` câu hỏi | 3–5 câu |
    | 12 | `h2` Đáp án | Nhớ lại | `ol`, mỗi đáp án 1–2 câu | Bằng số câu hỏi |
    | 13 | Khối Liên quan | Nối note | `footer` (xem dưới) | 1–3 dòng |

    **Tự kiểm tra** luôn có, kể cả khi yêu cầu không nhắc tới. Câu hỏi buộc người đọc suy luận: "Vì sao …?", "Điều gì xảy ra nếu …?", "Trường hợp này dùng cái nào?". Không hỏi lại định nghĩa, không hỏi câu mà khung Ghi nhớ / Tóm tắt đã trả lời nguyên văn.

    **Khối Liên quan** đặt cuối bài: `<footer class="mt-4 pt-3 border-top small text-body-secondary">`, mỗi dòng một `p class="mb-1"` mở bằng nhãn `strong`: "Cần biết trước:", "Học tiếp:", và "Nên tách thành note riêng:" khi chủ đề vượt phạm vi. Mỗi dòng nêu 1–3 tên chủ đề ngắn để người dùng nối thẻ trên Board; ưu tiên tên trong dòng **Note liên quan** của yêu cầu.

    Ba quy tắc về mạch bài:
    - **Giải thích trước khi dùng:** thuật ngữ mới phải được giải thích bằng một câu trước lần đầu xuất hiện trong bảng, sơ đồ hoặc câu hỏi; không dùng trước rồi định nghĩa ở mục sau.
    - **Một ví dụ xuyên suốt:** sơ đồ, code và câu văn dùng cùng một ví dụ với cùng tên, đường dẫn và số liệu; không đổi ví dụ giữa chừng nếu không nhằm so sánh.
    - **Ghi nhớ là điểm chốt:** sau khung Ghi nhớ / Tóm tắt chỉ còn Tự kiểm tra, Đáp án và khối Liên quan, không thêm đoạn văn hay ý mới. Ý quan trọng còn sót thì đưa vào khung lỗi hay gặp hoặc danh sách ghi nhớ.

    Để bài sinh động mà không dài:
    - Mỗi khái niệm đi kèm ngay một ví dụ cụ thể (con số, câu, đoạn code thật), không giải thích hai đoạn rồi mới cho ví dụ.
    - Cái gì vẽ được thì vẽ: quy trình, quan hệ, trước và sau, cấu trúc đều thành sơ đồ (mục 19) thay cho đoạn văn mô tả.
    - Dùng đúng một ví von đời thường cho cả bài và nhắc lại nó khi cần, không đổi ví von giữa chừng.
    - Viết trực tiếp với người đọc ("bạn"), câu ngắn, động từ chủ động. Bỏ câu mở đầu chung chung ("Trong thời đại ngày nay…") và câu chuyển ý không mang thông tin.
    - Mỗi ý chỉ xuất hiện một lần; phần Ghi nhớ / Tóm tắt nhắc lại kết luận, không giải thích lại.
    - Vượt giới hạn từ của mẫu thì cắt ví dụ phụ và chi tiết ngoại lệ trước, giữ nguyên sáu câu hỏi.
19. Sơ đồ, hình minh hoạ và video. Board không hỗ trợ `svg` hay `canvas` viết tay, nhưng màn hình đọc tự vẽ **sơ đồ Mermaid** và phát **video YouTube**. Bài học ngắn có ít nhất 1 sơ đồ, bài học dài có 2–3; loại tài liệu khác dùng khi có quy trình hoặc quan hệ cần nhìn. Trên mỗi sơ đồ có một câu dẫn; dưới sơ đồ dựng bằng khối HTML có một dòng chú thích `p class="small text-body-secondary"`.

    **Sơ đồ Mermaid (ưu tiên khi có nhánh, vòng lặp, nhiều bên trao đổi hoặc hơn 5 hộp):**
    - Viết mã Mermaid trong `<pre><code class="language-mermaid">…</code></pre>`. Trong mã, thay `<` bằng `&lt;`, `>` bằng `&gt;`, `&` bằng `&amp;` (mũi tên viết `--&gt;`, `-&gt;&gt;`).
    - Loại dùng được: `flowchart` (quy trình, nhánh, vòng lặp), `sequenceDiagram` (các bên trao đổi theo thời gian), `stateDiagram-v2` (trạng thái), `classDiagram`, `erDiagram`, `gantt`, `pie`, `mindmap`.
    - **Cấm, vì Board sẽ không vẽ mà chỉ hiện mã nguồn:** `%%{init …}%%` và mọi chỉ thị `%%{`, khối frontmatter `---` ở đầu, các dòng `style`, `classDef`, `click`, mọi URL (`http:`, `https:`, `data:`), ảnh (`img:`), bố cục ELK. Không tự đặt màu: Board tô màu theo theme sáng và tối.
    - Nhãn ngắn (dưới khoảng 5 từ), chỉ là chữ thuần, không chứa thẻ HTML; nhãn có ký tự đặc biệt như `/`, `(`, `?` thì đặt trong ngoặc kép: `A["GET /users/10"]`. Mỗi sơ đồ tối đa khoảng 12 nút; nhiều hơn thì tách hai sơ đồ. Chuỗi thẳng dài hơn 6 nút dùng `flowchart TD` (dọc) thay cho `LR`, vì sơ đồ quá rộng sẽ phải cuộn ngang. Mỗi tài liệu tối đa 20 sơ đồ.
    - Ví dụ:

      ```html
      <p>Mỗi lượt kiểm tra điều kiện trước khi chạy thân vòng lặp:</p>
      <pre><code class="language-mermaid">flowchart LR
        A["Khởi tạo i = 0"] --&gt; B{"i &lt; 5 ?"}
        B --&gt;|đúng| C["Chạy thân vòng lặp"]
        C --&gt; D["Tăng i"]
        D --&gt; B
        B --&gt;|sai| E["Kết thúc"]</code></pre>
      <p>Trình duyệt hỏi, máy chủ trả lời:</p>
      <pre><code class="language-mermaid">sequenceDiagram
        participant C as Trình duyệt
        participant S as Máy chủ
        C-&gt;&gt;S: GET /api/products/10
        S--&gt;&gt;C: 200 OK kèm JSON</code></pre>
      ```

    **Sơ đồ dựng bằng khối HTML (cho luồng thẳng 3–5 hộp, trước và sau, hoặc khi cần phân loại bằng màu):**
    - **Hộp sơ đồ:** `div` có `px-3 py-2 rounded border` cùng một bộ ba màu theo theme, ví dụ `bg-primary-subtle text-primary-emphasis border-primary-subtle`. Chữ trong hộp dưới khoảng 5 từ. Dùng màu để phân loại (đầu vào, xử lý, kết quả), tối đa 3 màu.
    - **Luồng thẳng:** `div class="d-flex flex-wrap align-items-center gap-2 mb-2"` chứa các hộp xen kẽ mũi tên `<span class="fs-4 text-body-secondary">→</span>`. Tối đa 5 hộp một hàng.
    - **Trước và sau, nguyên nhân và kết quả:** `row g-3 align-items-center` gồm `col-md-5`, `col-md-2 text-center fs-3` chứa mũi tên →, `col-md-5`; hai bên là `card`.
    - **Phân loại:** một hộp gốc căn giữa, bên dưới `row g-3` các `col-md-4`, mỗi nhánh một `card h-100`; hoặc `ul` lồng tối đa 2 cấp.
    - **Dòng thời gian, các giai đoạn:** `ul class="list-group"`, mỗi `li class="list-group-item"` mở bằng `span class="badge text-bg-primary me-2"` ghi số hoặc mốc.
    - **Cấu trúc, bộ nhớ, bố cục:** `table table-bordered text-center` với ô ngắn, hoặc sơ đồ ký tự trong `<pre><code class="language-text">`.

    **Biểu tượng:** được dùng emoji làm biểu tượng ở đầu nhãn khung hoặc tiêu đề `card` (💡 ý chính, ⚠️ lỗi, ✅ đúng, ❌ sai, 🎯 mục tiêu, 🧠 ghi nhớ), mỗi khối tối đa một cái; không rải emoji trong đoạn văn và không đặt trong `h1`–`h3`.

    **Ảnh thật:** chỉ dùng ảnh có trong dòng **Ảnh** của yêu cầu, là URL `https://` hoặc chuỗi `data:image/png|jpeg|webp|gif;base64,…` do người dùng đưa (Board chuyển ảnh base64 thành tệp đính kèm khi Nhập HTML; mỗi ảnh tối đa 10 MB). Đặt trong `<figure class="text-center">` với `img class="img-fluid rounded"`, `alt` mô tả và `figcaption class="small text-body-secondary"`. Không có ảnh thì dùng sơ đồ; không tự tìm, tự bịa URL hay tự sinh chuỗi base64.

    **Video YouTube:** chỉ dùng URL có trong dòng **Video** của yêu cầu, không tự bịa URL hay mã video. Viết thành một đoạn riêng: `<p><a class="board-video" href="https://www.youtube.com/watch?v=MÃ_VIDEO">Tiêu đề video</a></p>`. Board hiện khung phát 16:9 và chỉ tải video khi người đọc bấm phát; nhận các dạng `youtube.com/watch?v=`, `youtu.be/`, `youtube.com/shorts/`, `youtube.com/embed/`. Đặt video ngay sau mục mà nó minh hoạ, kèm một câu nói rõ nên xem để thấy điều gì; nội dung chính của bài vẫn phải đọc hiểu được khi không xem video.

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

Ví dụ 4 — bài học theo mẫu ngắn 5W1H (mục 18) có sơ đồ Mermaid (mục 19):

```html
<article><h1>Vòng lặp for trong Java</h1><p class="lead">Vòng lặp <code>for</code> chạy lại một đoạn code với số lần biết trước, để bạn không phải chép cùng một lệnh nhiều lần.</p><div class="alert alert-info"><strong>💡 Hình dung:</strong> giống chạy 5 vòng quanh sân: bạn biết vòng bắt đầu, vòng kết thúc và đếm thêm một sau mỗi vòng.</div><h2>Vì sao cần</h2><p>Muốn in 100 dòng, bạn không viết 100 lệnh in. Bạn viết một lệnh và để vòng lặp chạy nó 100 lần; khi đổi thành 1000 dòng chỉ cần sửa một con số.</p><h2>Khi nào dùng</h2><ul><li>Khi biết trước số lần lặp, ví dụ duyệt 10 phần tử của một mảng.</li><li>Khi cần biến đếm <code>i</code> để biết đang ở lượt thứ mấy.</li></ul><h3>Dễ nhầm với while</h3><table class="table table-bordered table-sm"><thead class="table-light"><tr><th scope="col">Tiêu chí</th><th scope="col">for</th><th scope="col">while</th></tr></thead><tbody><tr><th scope="row">Số lần lặp</th><td>Biết trước</td><td>Chưa biết</td></tr><tr><th scope="row">Biến đếm</th><td>Nằm ngay trong dòng <code>for</code></td><td>Tự khai báo bên ngoài</td></tr><tr><th scope="row">Ví dụ</th><td>In 5 dòng</td><td>Đọc cho tới hết file</td></tr></tbody></table><h2 class="mt-4">Cách viết</h2><p>Mỗi lượt kiểm tra điều kiện trước, đúng thì chạy thân vòng lặp rồi tăng <code>i</code>:</p><pre><code class="language-mermaid">flowchart LR
  A["Khởi tạo i = 0"] --&gt; B{"i &lt; 5 ?"}
  B --&gt;|đúng| C["Chạy thân vòng lặp"]
  C --&gt; D["Tăng i"]
  D --&gt; B
  B --&gt;|sai| E["Kết thúc"]</code></pre><p>Viết ba phần trong một dòng, đoạn sau in các số từ 0 đến 4:</p><pre><code class="language-java">for (int i = 0; i &lt; 5; i++) {
    System.out.println(i);
}</code></pre><h2 class="mt-4">Ghi nhớ</h2><div class="alert alert-warning"><strong>⚠️ Lỗi hay gặp:</strong> viết <code>i &lt;= 5</code> thì vòng lặp chạy 6 lần. Đếm từ 0 thì dùng <code>i &lt; 5</code>.</div><div class="alert alert-success"><ul class="mb-0"><li>Ba phần: khởi tạo, điều kiện, bước tăng.</li><li>Dùng khi biết trước số lần lặp.</li><li>Đếm từ 0 và so sánh bằng <code>&lt;</code>.</li></ul></div><h2>Tự kiểm tra</h2><ol><li>Vì sao đoạn code trên dừng ở 4 mà không in 5?</li><li>Điều gì xảy ra nếu bạn quên viết <code>i++</code>?</li><li>Cần hỏi mật khẩu cho tới khi người dùng nhập đúng: dùng <code>for</code> hay <code>while</code>?</li></ol><h2>Đáp án</h2><ol><li>Khi <code>i</code> bằng 5, điều kiện <code>i &lt; 5</code> sai nên vòng lặp dừng trước khi in.</li><li><code>i</code> luôn bằng 0, điều kiện luôn đúng, vòng lặp chạy mãi.</li><li><code>while</code>, vì không biết trước số lần lặp.</li></ol><footer class="mt-4 pt-3 border-top small text-body-secondary"><p class="mb-1"><strong>Cần biết trước:</strong> biến và kiểu <code>int</code>, toán tử so sánh.</p><p class="mb-1"><strong>Học tiếp:</strong> vòng lặp <code>while</code>, duyệt mảng bằng <code>for</code>.</p></footer></article>
```

## F. Tự kiểm tra trước khi trả lời

- Mọi thẻ, thuộc tính, class và thuộc tính CSS đều nằm trong danh sách trên; thứ gì không có thì bỏ, không tự bổ sung tính năng.
- Đúng một `h1`, có `lead`, các mục là `h2`/`h3` ngắn gọn; không có `h2`/`h3` trong `card`, `alert` hay bảng; không có mục lục tự viết.
- Không còn `bg-light`, `text-muted`, `text-dark`, `bg-white`; không có màu chữ hex đặt riêng trên nền mặc định; không có `font-size` hay `width` bằng `px` trên đoạn văn.
- Không có ba đoạn văn liền nhau; mỗi khối code có câu dẫn.
- Nếu là bài học: một vấn đề duy nhất; đúng thứ tự mục và giới hạn độ dài của mẫu ở mục 18; có sơ đồ, bảng "Dễ nhầm với", Tự kiểm tra kèm Đáp án và khối Liên quan; mỗi khái niệm có ví dụ; không ý nào lặp lại.
- Nếu là bài học: không thuật ngữ nào được dùng trước khi giải thích; sơ đồ, code và câu văn dùng chung một ví dụ; không có đoạn văn nào sau khung Ghi nhớ / Tóm tắt ngoài Tự kiểm tra, Đáp án và Liên quan.
- Sơ đồ chỉ dùng Mermaid hoặc khối ở mục 19; không có `svg`; mã Mermaid không có `%%{`, `style`, `classDef`, `click`, URL, và đã thay `<`, `>`, `&` bằng thực thể HTML.
- Không có URL ảnh hay video nào ngoài dòng **Ảnh** và **Video** của yêu cầu.

**Yêu cầu nội dung của tôi:**

- Chủ đề: [ví dụ: Authentication và Authorization trong Spring Boot]
- Loại: [Bài học ngắn | Bài học dài | So sánh | Hướng dẫn | Tra cứu / API | Ghi chú / tổng kết]
- Người đọc: [ví dụ: lập trình viên backend mới, đã biết Java cơ bản]
- Mục tiêu: [đọc xong làm được gì]
- Ngôn ngữ: [Tiếng Việt | English | song ngữ]
- Độ dài: [ngắn ~300 từ | vừa ~700 từ | dài ~1500 từ; bỏ trống nếu là bài học, mẫu ở mục 18 đã quy định]
- Bắt buộc có: [ví dụ: bảng so sánh, một ví dụ code Java, sơ đồ luồng xử lý]
- Ảnh: [URL ảnh thật hoặc chuỗi data:image base64 nếu có, mỗi ảnh kèm mô tả; bỏ trống thì chỉ dùng sơ đồ]
- Video: [URL YouTube thật nếu có, mỗi URL kèm tiêu đề và nội dung chính; bỏ trống thì không có video]
- Note liên quan: [tên các note đã có trên Board để nối ở khối Liên quan; có thể bỏ trống]
- Ghi chú thêm: [nguồn, thuật ngữ cần giữ nguyên, điều cần tránh]

---

## Cách dùng kết quả trong Board

1. Mở note, vào editor HTML, chọn **Nhập HTML**, dán đoạn HTML rồi bấm **Kiểm tra HTML**. Giới hạn: phần HTML không tính ảnh base64 tối đa 1 MB; cả đoạn dán tối đa 10 MB; mỗi ảnh base64 tối đa 10 MB và phải là PNG, JPEG, WebP hoặc GIF.
2. Đọc danh sách "Phần không hỗ trợ hoặc không an toàn đã loại" và bản xem trước. Ảnh base64 hợp lệ được báo "Đã chuyển … ảnh thành tệp đính kèm"; ảnh sai định dạng hoặc quá lớn nằm trong danh sách đã loại. Nếu có phần bị loại hoặc bố cục chưa đẹp, gửi lại cho ChatGPT câu sau kèm danh sách đó: *"Board đã loại các phần sau: […]. Hãy sửa đúng những phần này theo quy tắc ở trên, giữ nguyên nội dung và cấu trúc còn lại, trả về toàn bộ HTML."*
3. Bấm **Thêm nội dung đã kiểm tra**, rồi **Áp dụng** trong Detail để lưu vào note.
4. Mở tab đọc của Detail, bật thử theme tối (nút ◐) và xem mục lục bên lề: nếu mục lục quá dài hoặc có khối khó đọc ở theme tối, yêu cầu ChatGPT sửa theo mục 7, 9 và 11.
5. Sơ đồ Mermaid và video chỉ hiện ở tab đọc; trình soạn thảo và bản xuất HTML vẫn hiện mã nguồn và liên kết. Nếu một sơ đồ hiện mã nguồn kèm dòng báo "không vẽ được" hoặc "không được hỗ trợ", gửi lại mã đó cho ChatGPT kèm câu: *"Board không vẽ được sơ đồ này. Hãy viết lại theo mục 19: bỏ `style`, `classDef`, `click`, `%%{init}` và mọi URL, kiểm tra cú pháp, trả về toàn bộ HTML."*
6. Video chỉ tải từ YouTube sau khi bạn bấm nút phát, nên cần mạng ở bước đó; bấm × hoặc Escape để đóng video. Sơ đồ rộng hơn cột đọc thì cuộn ngang trong khung của nó.

Để tạo nhiều note cùng phong cách trong một cuộc trò chuyện, dán prompt một lần rồi mỗi lần chỉ gửi lại khối **Yêu cầu nội dung** mới.

Trong app, ở chế độ code HTML (`</>`) của trình soạn thảo khối, nút ✦ sao chép sẵn phần prompt này, nút ? mở các mẫu HTML/CSS chèn được ngay, và nút ⇥ nhập HTML do AI trả về. Sau khi sửa file này, chạy `npm run sync:prompt` để cập nhật bản mà app sao chép (`assets/data/board-html-prompt.md`).

Quy tắc trên phản ánh bộ hỗ trợ hiện tại (xem `assets/js/graph/html-document.js` và `assets/js/detail/html-content.js`); không đảm bảo mọi kết quả do mô hình tạo đều hợp lệ, nên luôn kiểm tra bước "Kiểm tra HTML" trước khi thêm. Sơ đồ Mermaid được vẽ bởi `assets/js/detail/mermaid-render.js` theo chính sách ở `assets/js/graph/diagram-policy.js`; video bởi `assets/js/detail/video-embed.js`. Bootstrap được nạp cục bộ từ `assets/vendor/bootstrap.min.css` (v5.3.8); các component cần JavaScript của Bootstrap không hoạt động trong Board. Kiểu chữ, cột đọc và theme tối của tài liệu nằm ở `assets/css/document-content.css`.
