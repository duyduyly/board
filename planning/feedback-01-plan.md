# Kế hoạch nâng cấp Feedback 01

Ngày 2026-10-12. Nguồn: [feedback gốc](../wordspace/tasks/01-feedback/feedback-01.md), [đánh giá UX/UI](../project-context/business/feedback-01/feedback-01-analysis.md). Đợt 1 FB001–FB010 đã hoàn tất. Phạm vi hiện được giao: đợt4 FB024–FB029 ngày2026-10-13; đợt1–3 đã hoàn tất.

Checklist chính: [implementation-checklist.csv](implementation-checklist.csv). [feedback-01-checklist.csv](feedback-01-checklist.csv) là bản trích FB001–FB029; cập nhật master trước rồi tái tạo bản trích.

## Mục tiêu

Home giúp chọn template nhanh; Canvas có thư viện hình dạng/text/ảnh; Detail tập trung ở giữa; tài liệu và ảnh trao đổi offline; font lớn và resize có kiểm soát. Giữ nguyên nội dung/relations khi đổi cách hiển thị. Root index.html + assets, ESM/local libraries, JSON1.0, commands atomic, history và recovery opt-in tiếp tục áp dụng.

## Quyết định dùng làm baseline

User yêu cầu plan dựa trên đánh giá. Các lựa chọn dưới đây là baseline triển khai của plan, phải ghi vào spec ở FB001 trước code; không để developer tự suy đoán lại. Prototype có thể yêu cầu điều chỉnh kỹ thuật nhưng không được giảm scope âm thầm.

| Quyết định | Baseline |
|---|---|
| Mở Detail | Single click chọn; double click/action Open/Enter mở; text và image đều mở Detail |
| Palette | Click/keyboard tạo ở giữa viewport; kéo thả tạo tại vị trí thả; Format đổi shape node đã có |
| Điều hướng | Sidebar thư viện mới; search/fulltext/list chuyển drawer; Guide/recovery/count trạng thái vào menu dự án |
| Detail | Modal giữa: 75vw, max1120px, max90vh; Full là đầy viewport; body đọc max80ch |
| Đóng Detail | X/Escape/backdrop dùng chung guard; không mất draft; ảnh mở thì Escape đóng ảnh trước |
| Viewer | Click/keyboard; default Fit ≤75vw×75vh, không upscale ảnh nhỏ; có Fit/100% chủ động |
| Node file | Project JSON1.0 một card, relations rỗng, namespace project lọc theo card; xuất snapshot đã Apply mặc định |
| Node import | Update hiện tại hoặc Add mới; Update content/metadata/ảnh mặc định, giữ ID/relations/geometry/appearance/node kind; lấy format qua tùy chọn |
| Markdown | UTF-8 .md Replace/Append vào draft content, giữ metadata; relative images báo cần chọn/chèn ảnh, không đọc file ngầm |
| Font/size | Title/text12–72px; Manual hoặc Fit text; font+size Apply atomic, geometry chỉ active view; legacy default giữ nguyên |
| Shapes | Basic: rectangle/rounded/square/circle/ellipse/diamond/triangle/hexagon. Extended: star/heart/octagon/arrow/equilateral/isosceles/right triangle |
| Oval/ellipse | Một shape ellipse, tránh trùng tên |
| Gallery | Templates đóng gói local, không tự lưu project; theme/locale trong phiên; 4–5 cột rộng, 3 tablet, 2 mobile và 1 khi quá hẹp |

Nếu feature ảnh thuần không có text, Fit text đo cover/khung tối thiểu theo kind thay vì Markdown. Triangle cơ bản dùng equilateral; không tạo enum duplicate, palette có thể dùng label tương đương. Shape hiển thị không thay type hoặc node kind.

## Phạm vi và phần giữ ngoài

Bao gồm cả hình mở rộng user nêu, chia thành milestone riêng để không chặn basic release. Giữ export Markdown hiện có, portable node JSON kèm ảnh; ZIP .md+images, sửa/crop ảnh, pin Detail sang phải, SVG upload tùy ý và editor mobile đầy đủ nằm ngoài đợt này. Existing BACKLOG B101–B204 không tự được giao bởi plan này.

Template Gallery mobile dùng được cho browsing; nếu mở editor ở màn hình chưa hỗ trợ phải hiển thị hướng dẫn desktop, không hứa editor mobile. Thư viện ban đầu có 4–6 template hợp lệ, bao phủ Personal/Learning/Work/Project, dùng preview thống nhất từ map thật.

## Các đợt và gate

| Đợt | IDs | Kết quả có thể nghiệm thu |
|---|---|---|
| Chuẩn bị | FB001–FB002 | Contract/decisions + baseline/visual reference; đủ rõ trước code |
| 1 — Gallery và đọc tập trung | FB003–FB010 | Gallery/Home, Detail modal, viewer click; regression và gate |
| 2 — Trao đổi tài liệu offline | FB011–FB016 | Markdown import, node JSON với ảnh, preview/guards/undo và gate |
| 3 — Shapes cơ bản và kích thước | FB017–FB023 | Prototype geometry, basic shapes, palette/navigation, resize/font/Fit text và gate |
| 4 — Shapes mở rộng và toàn bộ release | FB024–FB029 | Shapes còn lại, examples/docs, full regression/benchmark và final gate |

Không bắt đầu đợt sau chỉ vì có TODO: user hiện giao đợt4. Khi user giao một đợt, ghi owner/IN_PROGRESS, chạy verification và evidence trước DONE. Gate từng đợt không thay final gate; bugs ở đợt trước phải mở lại đúng task nếu acceptance không đạt.

## UX/UI chi tiết

### Gallery và session navigation

Header logo/New/Import/theme/locale; category tabs All/Personal/Learning/Work/Project. Template tile chỉ preview4:3 và title2lines; gap20–24px/radius10–12px/viền nhẹ. Loading/error/empty/focus rõ. Template fetch stage+validate trước replace, lỗi giữ project cũ. Home giữ session project đang mở và nút Tiếp tục; mở khác/New/Import mới đi qua replacement guard. Về Home không tự export hoặc persistence.

### Detail và viewer

Tái sử dụng một Detail controller, giữ Overview/Edit/Format, TOC, Mermaid, preview và editor cursor/scroll. Header/tabs/footer cố định, body cuộn. Modal stack có Detail, viewer và confirm guard; chỉ layer trên cùng nhận Escape/focus. Canvas inert khi Detail mở, focus return về node/action phù hợp kể cả node bị xóa. Backdrop click chỉ đóng khi pointer bắt đầu và kết thúc trên backdrop. Image trong body max-height360px/contain; portrait/landscape/ảnh nhỏ/GIF không crop. Không request URL ngoài chỉ vì mở viewer.

### Import/export và ảnh

Import source phải stage, validate, preview, rồi sửa draft hoặc commit một command; không có replace project ngầm. Markdown vượt100.000 ký tự bị từ chối, tổng project≤10MiB; file text có decode error báo rõ. Missing relative images được liệt kê; không tự fetch. HTML/Mermaid đi qua policy hiện có.

Node export một-card project: giữ unknown card extensions hợp lệ; Root chỉ giữ khi chính card là Root, views chỉ giữ geometry card đó; bỏ graph references tới ID ngoài file. Unknown project extensions không chứng minh độc lập phải có warning/explicit exclusion policy trước export, không âm thầm bỏ. Card images giữ ảnh content/cover tham chiếu; unused attachment có lựa chọn include-all để tránh mất tài nguyên khi tiếp tục soạn offline. Dangling attachment báo lỗi. Xuất draft cần validate và không Apply ngầm.

Update import: content/title/summary/type/tags và ảnh được preview; giữ format/kind mặc định; attachment merge/remap đảm bảo cover hiện tại không bị đổi mất. Tùy chọn lấy format/kind cần validate cover và chỉ geometry active view nếu cho phép lấy size; không import position làm nhảy node. Add tạo ID mới, geometry ở viewport, không làm Root hoặc nối branch tự động. Giữ extension chưa thay thế; conflict unknown extension báo cho người dùng trước merge.

### Shapes và auto-size

Shape registry tập trung: outline, safe text area, ratio, anchors và hit test. Renderer/preview/resize dùng cùng geometry, controls ngoài vùng clip. Polygon/SVG do app tạo, bounds độc lập zoom; không nhận CSS/path tùy ý từ JSON. Chốt shape enum/default/fallback, min-size, font bounds và sizeMode trong typed namespace ở FB017, đồng bộ serializer/AI Guide/types/schema.

Rectangle giữ card overview; hình chật giữ title ngắn và ẩn summary/tags trên Canvas theo policy rõ, vẫn giữ đầy đủ trong Detail. Image nodes contain/cover theo safe area. Text contrast/theme/transparent nhất quán.

Manual resize selected node: handles khác connector, min/max và ratio theo shape, pointer capture, drag threshold, cancel/Escape/blur không commit dở; pointerup một history entry. Fit text chỉ đo overview, width mục tiêu giới hạn rồi height; square/circle giữ ratio. Font change default Fit text khi người dùng chọn chế độ này; không resize khi theme/locale/render. Khi không fit trong bounds, cảnh báo trước Apply và không ghi geometry lỗi. Không tự chạy layout; Fit camera không đổi size.

## Kiến trúc triển khai

Theo [development.md](../docs/development.md): ui/template-gallery, ui/shape-palette/navigation, detail/detail-dialog/image-viewer/node-transfer, graph/shape-registry/fit-text được tạo khi có use case. app điều phối guards/session, common chỉ primitives dùng thật. Không thêm controller khổng lồ hoặc module import ngược app. Query index chỉ committed snapshot. Session Home/modal/viewer/collapse/locale không serialize; dữ liệu shape/font/size mode có namespace typed. Thư viện mới phải kiểm tra docs chính thức, pin version và ghi lý do; không runtime CDN.

## Kiểm chứng và evidence

Mỗi task có acceptance/check riêng trong CSV. Core tập trung import semantics, refs, geometry, history và deterministic measurement policy; browser cho focus/drag/layout/visual. Kiểm tra vi/en, light/dark, desktop1440/1050; Gallery tablet/mobile; editor mobile vẫn notice.

Full release: Chrome/Edge/Firefox, guards/draft/undo/recovery/round-trip/unsafe Markdown/Mermaid/no-upload/no-default-storage. Benchmark riêng 500nodes/2000relations mixed shapes/images ở hai view: import≤3s, Overview≤200ms, median pan≥45FPS10s, radial preview≤3s; ghi máy/browser/dataset và overlaps. Không đổi target để đạt pass. Nếu shape timing không đạt, xử lý trước DONE.

npm test/check/typecheck/format:check/build; static architecture gate không cycle/upward imports. CSV BOM/CRLF14columns, unique IDs/deps tồn tại/acyclic, DONE evidence/date, bản trích khớp master. Evidence task đặt planning/feedback-01-*-evidence.md, không dùng report đánh giá làm bằng chứng code chạy.

## Tiến độ hiện tại

Đợt 1 FB001–FB010 DONE. Đã code Gallery6template/categories/Home/Continue, native Detail75%/Full, single select/Open, click viewerFit/100% và common dialog lifecycle. Core37/37, lint/architecture29modules/typecheck/format/build PASS; benchmark500nodes/2000relations hai view đạt targets sau tối ưu offscreen paint. Final browser matrix180/180 + portrait/GIF3/3 PASS Chrome/Edge/Firefox. Gate đợt1 PASS, evidence: [feedback-01-phase1-evidence.md](feedback-01-phase1-evidence.md). Master92DONE/19TODO/10BACKLOG; không IN_PROGRESS/BLOCKED.

Files: index.html, assets/css/focused.css, ui/template-gallery/dialog-surface, app/adapter/detail/image-preview/i18n, catalog/templates/previews, tests/UI driver, benchmark script, README/AGENTS/development và planning evidence. Không thay JSON1.0/dependencies. Không blocker. Đợt 2 FB011–FB016 đã hoàn tất ở cập nhật bên dưới. Đợt3–4 FB017–FB029 và BACKLOG cũ chưa được giao code.

## Feedback01 đợt2 — contract FB011

2026-10-12 user giao FB011–FB016. Portable node là normalized Project1.0 đúng một card, relations rỗng; validate toàn file trước dùng. Export default committed, draft explicit không Apply; include-all attachments mặc định, bỏ unused chỉ khi chủ động. Dangling attachment token/cover từ chối. Root chỉ giữ nếu card chính làRoot; mindMap positions/sizes lọc card ID, giữ viewport; unknown project namespaces loại bỏ chỉ sau checkbox xác nhận, liệt kê tên. Unknown card namespaces giữ nguyên.

Update import dùng draft hiện có, thay title/summary/type/tags/content và merge attachments, không commit ngầm. Apply một command/Undo cả thay đổi. Giữ ID/relations/position/size/style/appearance/node kind mặc định; option lấy format nhận style/appearance/kind và size chỉ active view, không lấy position. Incoming attachment ID collision khác record đổi sang id-import-N deterministic; rewrite attachment tokens và incoming cover; giữ cover/attachments hiện có. Unknown card extension merge giữ keys absent, conflict default giữ existing và option explicit lấy incoming. Unknown project namespace không merge vào project đích, bắt buộc acknowledge exclusion. Add ID mới, đặt ở viewport, geometry active view, không tự Root/branch; chỉ sau preview mới chạy draft guard rồi commit atomic. Cancel/error không đổi project/draft.

Markdown chỉUTF8 .md, decode fatal, source≤10MiB, kết quảcontent≤100k và canonical project≤10MiB. Replace/Append vào draftcontent, giữ metadata. Data URI PNG/JPEG/WebP/GIF do Markdown export tạo được stage thành attachment validated và decode browser trước nhận; HTMLdata/SVG/unsafeURI giữ source và render policy chặn. Relative/protocol-relative/unsupported image sources liệt kê để người dùng chèn ảnh từ máy; không đọc/fetch file ngầm. Remotehttps theo external opt-in phiên. Preview luôn sanitizeMarkdown/Mermaid và chặnảnhngoài; không thêmnetwork/upload/storage. Attachment:ID tokens được giữ/remap kể cả code tham chiếu để tránh dangling; unknown extension refs không tự suy đoán/remap.

### Đợt2 đã hoàn tất

FB011–FB016 DONE; master98DONE/13TODO/10BACKLOG, không IN_PROGRESS/BLOCKED. Core46/46, fullUI210/210 Chrome/Edge/Firefox + transfer27/27 hardening recheck + surface9/9 PASS. Typecheck/lint/architecture32modules/format/build và benchmark hai view đạt targets. Evidence: [feedback-01-phase2-evidence.md](feedback-01-phase2-evidence.md).

Files: json/node-transfer, detail/markdown-import, ui/document-transfer, app/feedback/i18n/FormatGuide/CSS, portableexample, tests, README/AGENTS/development và planning. JSON1.0/dependencies/storage mặc định giữ nguyên; spec contract FB011 đồng bộ. Không blocker/task đang dở. Đợt3–4 FB017–FB029 chưa triển khai; tiếp theo FB017 khi user giao đợt3. Không tự code BACKLOG/publish.

## Feedback01 đợt3 — contract FB017

User giao FB017–FB023 ngày2026-10-12; FB024–FB029 vẫn chưa giao. Namespace card-atlas:appearance thêm shape optional enum rectangle/rounded/square/circle/ellipse/diamond/triangle/hexagon, sizeMode manual|fit (defaultmanual), titleFontSize12–72. Không shape giữ rendering legacy; không fallback unknown shape. Triangle là tam giác đều, ellipse bao gồm oval. Shape không đổi type/kind; tight shapes chỉ title/cover, summary/tags giữ Detail. Shape shared hai view, geometry độc lập: ratio shape inscribed trong bounds hiện có (không sửa view còn lại); resize/Fit chủ động tạo bounds đúng ratio. Explicit shape edits96×64 đến1200×1000; geometry legacy/import hiện có vẫn giữ, finite positive contract. Registry sinh polygon outline dùng chung SVG/Cytoscape/hit/anchors/safeArea; controls ngoài clip. Rounded dùng radius, các shape khác có góc theo hình học.

Manual pointerresize góc dưới phải, screen threshold3px, preview không mutate model; pointerup1command, Escape/blur/cancel/lostcapture rollback. Resize chuyển sizeMode vềmanual. Fit chỉ overview đã sanitize thànhtext; targetwidth rồiheight, ratio giữ, tối đa limits. Font+size Apply atomic activeview; không resize do render/locale/theme. Image-only Fit dùng khungcover240×180 tối thiểu; thiếu cover validation hiện hữu. Fit không đủ bounds cảnh báo và chặnApply, giữdraft. Navigation sidebarpalette, search drawer, Guide/recovery/count projectmenu; keyboardclick/drop screen→graph, không autoplay layout. Không thêmdependency/storage/network.

## Đợt4 — contract FB024

User giao FB024–FB029 ngày2026-10-13. Thêm enum star/heart/octagon/arrow/isosceles-triangle/right-triangle; triangle vẫn là tam giác đều (alias label, không enum duplicate). Star/heart ratio1; isosceles và right triangle không khóa ratio. Shapes compact chỉ title/cover. Outline concave app-owned polygon, safeArea chữ nhật nằm hoàn toàn trong hình; ray anchor dùng giao điểm gần nhất từ tâm nằm trong hình. SVG/Cytoscape/hit/preview/resize/Fit dùng chung registry, không CSS/path từ JSON. Shape geometry activeview, Undo/guards/limits giữ nguyên. Prototype chứng minh trước mở FB025.

## Tiến độ hiện tại — đợt4 hoàn tất

FB001–FB029 DONE ngày2026-10-13; toàn master111DONE/10BACKLOG, không TODO/IN_PROGRESS/BLOCKED. Shapes14, font12–72, mixedexample và Guide hoàn tất. Core52/52, fullUI234/234 + palette optimization recheck51/51, static/typecheck/format/build PASS. Isolated benchmarks500/2000 bothviews đạt fixedtargets; xem [feedback-01-phase4-evidence.md](feedback-01-phase4-evidence.md). Files: assets sharedregistry/schema/types/i18n/Guide/palette/example, tests/benchmark, README/AGENTS/development/planning. Không blocker; BACKLOG chưa được giao. Commit/push thực hiện theo yêu cầu user trước đó sau gate.
