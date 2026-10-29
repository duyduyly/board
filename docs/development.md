# Phát triển và mở rộng Card Atlas

E037: Markdown lazily imports local highlight.js11.12.0 core with9grammars from scripts/highlight-entry.js, bundled separately to assets/vendor/highlight-entry.js (67,401 bytes uncompressed). Explicit fenced language only, aliases via grammar registry, no auto detection; unknown/unlabeled/over20k code stays plain. Highlight markup goes through existing DOMPurify sanitation; raw HTML stays escaped. Mermaid uses its existing independent renderer. isCurrent checked after import, normal renderer fallback if local import fails. CSS token palette adapts to existing app theme only, without changing card colors. Build copies the BSD license beside the local bundle. Official docs: https://highlightjs.org/ and https://highlightjs.readthedocs.io/en/latest/api.html.

E035: ui/format-inspector owns the right dock and explicit global-action form. Detail's existing Format/relation renderer is moved into the dock and opened as a nonmodal dialog; content Overview/Edit remains modal. Do not append an already open dialog to the same parent: reparenting removes native top-layer modality while retaining open. Text typography uses the existing overview editor inside the dock. Header Format is a shortcut, not a second format form. Bulk colors/type/routes/arrow style use one command, skip pins/incident edges, and preserve active-view Fit validation and inactive-view geometry. Global checkboxes are one-shot actions for existing elements, not persisted defaults.

E033: explicit Detail form submit awaits shared detailSurface.requestClose only after applyDraft succeeds, then announces top success. applyDraft itself stays nonclosing for navigation/draft/export guards; no-op succeeds, invalid/Fit/pinned failure stays open. Canvas overview/date direct commits announce top success and keep their existing close-on-success behavior; nested overview updates still stage the parent draft without committing it. Feedback toast accepts optional position/detail; unrelated messages reset to default bottom, and history-limit notice is preserved alongside success. Tests that intentionally continue editing reopen via native UI/keyboard after a successful close, rather than bypassing inert or invoking product callbacks.

E032 adds opt-in per-view edge.modes auto/manual, default manual for legacy files. graph/auto-routing is a pure bounded rectilinear router and batch-enablement helper; canvas/auto-edges owns cache/status and supplies current Cy geometry/outline polygons. Cache keys include visible geometry and enabled topology; same project/view/hidden identity fast-exits for selection/locale, pan never routes. Full committed geometry/preview/collapse sync recomputes when needed. Geometry results are renderer-only, not exported. Ports intersect shared shape outlines, edge segment projections use node-position with explicit relative endpoints. Fanout lanes and overlap penalties reduce shared runs, bounded grid fallback handles multi-turn detours. Failure is visible as a faded dotted connector plus warning status; no false guarantee for overlap/blocked geometry or search limits. Mode toggles preserve stored manual corners/scalars and inactive-view mode. Batch skips pins/manual intent. Manual editing action explicitly changes mode through commands. Relation tap now opens same-selected relation after modal close. No ELK/new dependency, node movement, API or hidden persistence.

E031: card-atlas:edge.corners stores a bounded per-view source/target control offset pair and a fixed horizontal/vertical departure axis. Controls are relative to endpoint centers; they are not relation endpoints. orthogonalCorners derives elbow geometry with axis-aligned intermediate segments, removes duplicate/collinear runs, then maps to Cytoscape node-position coordinates. Two square controls edit independently in2D; center circle translates both once corners exist. Scalar E030 edits still render unchanged. Reset clears both current-view forms, keeping the other view. UI does not mutate graph/cache directly. No automatic obstacle avoidance or new dependency.

E030: graph/edge-routing owns bounded per-view manual offsets and pure edgePath geometry. canvas/edge-editor owns session handles and preview; app port commits setEdgeOffset atomically. applyEdgePath clears only its own Cytoscape bypass properties, with scratch flag so legacy graphs skip unnecessary writes; scratch is renderer-only. Segment/control calculations use edge-distances:node-position to preserve orthogonal corners. No stored arbitrary points/CSS; rail geometry follows endpoint centers. Draft route change clears old offsets, other form fields preserve them. Pointer preview uses edgeDragging guard, capture/blur/Escape/viewport/sync rollback. Selection/view/project/layout/theme/locale render keeps editor visibility consistent; pin commit invariant unchanged.

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

E026–E028: canvas/overview chia sẻ caption: image kinds dùng summary, text dùng title+summary; compact text80px dùng compactOverview chung resize/shape/preview, measure bỏ compact clamp để Fit đúng. canvas/group-frames sở hữu DOM derived frame bounds, không là Cy compound hoặc model node; gesture dùng startGroupDrag với member IDs/capture handle. graph/card-groups giữ contract/crossrefs/cleanup/bounds; ProjectStore.remove dọn membership atomic. Group editor chỉ staging/ports, app giữ commands. card-atlas:groups typed project namespace; card-atlas:edge typed relation route namespace, validator/schema/download/type/guide đồng bộ. Không đưa renderer props hoặc session selection vào JSON, không sửa pinned invariant. Frame paint dùng node geometry hiện hành, view đổi/resize/cancel/layout giữ đồng bộ; Fit camera tính cả frame extents. Giữ một locale control toolbar.

E025: một control ngôn ngữ#locale duy nhất trên toolbar cho toàn web. Popup/Detail/feedback/date/overview không sở hữu locale selector hoặc onLocale callback. UI dịch qua i18n global và syncLocale khi mở; native dialogs vẫn giữ inert/focus, chọn ngôn ngữ trước khi mở. Không đóng modal/Apply/Discard draft tự động để đổi ngôn ngữ. Test driver chỉ đóng/reopen Detail sạch qua visible controls, không bypass inert hoặc thao tác locale trong draft đang mở.

1. Ghi yêu cầu và acceptance vào planning; xác định dữ liệu thuộc model hay session, chốt namespace trước khi code.
2. Viết command atomic và truy vấn thuần; kiểm tra validation, Undo và JSON round-trip.
3. Thêm field builder trong detail hoặc controller trong ui, nhận callbacks từ app; giữ các guards hiện có.
4. Renderer đọc geometry/model/session options, không sửa snapshot.
5. Dùng t(key) cho UI Việt/Anh; không dịch nội dung người dùng. Thêm style vào đúng lớp CSS và kiểm tra cả hai theme.
6. Chạy npm test, npm run check, npm run typecheck, npm run format:check; bổ sung browser/benchmark theo ảnh hưởng.

Chỉ đưa code vào common khi có ít nhất hai caller thực tế và cùng policy. Escape HTML không thay DOMPurify: Markdown/Mermaid vẫn phải sanitize. JSON clone trong validator có mục đích khác structuredClone của session, nên giữ riêng. Fixtures có mục đích khác nhau không gom chỉ vì cùng tên sample.

## Query cache

E023: app giữ selectedCards Set session bên cạnh primary selection của Detail. canvas/multi-selection nhận ports, giữ preview DOM/Cytoscape và một pointer transaction; cancel trên Escape/capture/blur/viewport/sync. adapter.paintSelection chỉ cập nhật các IDs trong tập cũ/mới. graph/move-cards chạy trong một commit, bỏ pins/dedup, chỉ active-view positions; khi kéo Card có Mind fallback thì materialize vị trí Mind cũ để không kéo theo view kia. Chặn command/shortcut trong gesture; group không export/recovery/history, bulk delete không thuộc scope. JSON1.0 và pin invariant giữ nguyên.

projectIndex(snapshot) xây cards/relations/degrees/incoming/outgoing trong O(N+E), lưu qua WeakMap. Chỉ dùng với committed snapshot; không dùng bên trong mutator đang sửa object và không sửa Map/array trả về. Commit, Undo hoặc Replace tạo snapshot mới nên nhận index mới. Locale và viewport không đổi dữ liệu graph. Cache không export, không nằm trong history hoặc recovery; snapshot cũ có thể được GC.

## Gates tự động

npm run check dùng ESLint AST để kiểm tra import/export: vòng phụ thuộc, module thiếu, common import ngược và module cấp thấp import app. no-unused-vars bắt import thừa sau khi tách code.

npm run typecheck kiểm tra contract TypeScript và checkJs cho common/html, common/data, graph/project-index. UI JavaScript chưa được typecheck toàn bộ; mở rộng từng module có JSDoc, không tắt strict để che lỗi.

## Giới hạn

Shortcut ChatGPT (E018): ui/chatgpt-launcher chỉ bind controls và mở URL cố định qua popup noopener/noreferrer theo click trực tiếp; không nhận store/model. Checkbox/hidden chỉ DOM session, không render graph hoặc ghi recovery. Link native target=_blank/rel=noopener noreferrer trong menu là fallback. Browser/OS quản lý cửa sổ, vị trí/kích thước chỉ là yêu cầu; không iframe/SDK/API/backend và không tích hợp hội thoại vào JSON.


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

Pin/date: graph/card-metadata giữ contract và pure mutation helpers; overview metadata strip dùng chung Canvas/Format, header ngoài text measurement trừ24px cho paper. Pushpin SVG app-owned local làm CSS background, không tạo SVG subtree cho từngnode. Paper default radius2 cho legacy/rectangle/square, rounded10 và explicitradius giữ nguyên; Format và Canvas lấy cùng appearance(). ProjectStore.contentSignature cache chỉ snapshot committed theoidentity, không dùng cho mutator; dirty/Undo/Redo/Replace/export giữ cùng semantics, không serialize lại vì selection/viewport.

### Ngày card và editor Canvas

E021: `isPinned` dùng chung cho mọi node/view. graph/card-lock kiểm invariant ở ProjectStore.commit trước validation/history; card ghim và mind geometry/root role/incidentrelations không được đổi, ngoại lệ unpin-only. Replay Undo/Redo và Replace có lifecycle riêng vẫn được phép. Canvas chặn customdrag/nativegrab/resize/connector/date/overviewedit trước mutation; Detail ghim chỉ Overview + unpin, relationlockedfields disabled, không mount transfereditor. Lớp commit vẫn chặn bypass từ draft/import/commands. Uniformstyle bỏ qua pinned; radial preview/apply giữ vị trí và báooverlap. Không dùng CSS làm khóa dữ liệu, không thêm JSONfields/sessionpersist.

`graph/card-metadata.js` là nguồn chung cho pin, UTC `createdAt` và ngày lịch optional `createdDate`. Không ghi đè timestamp gốc khi sửa ngày; duplicate dùng stampCreated và bỏ override. `ui/card-date-editor.js` dùng dialogSurface, draft local, port onApply/current; command nằm trong app/store. Canvas badge là control bàn phím, preview readonly. Không tạo input cho từng node: một editor dùng chung giúp giữ DOM nhỏ. Locale sync cache theo lựa chọn global, không reset draft.

## Popup overview E015

Graph/card-typography là policy thuần fields/font whitelist/mutation; Canvas/overview apply DOM dùng chung Canvas/Format/measurement. Namespace card-atlas:typography strict title/summary/type {fontSize8–72,colorHex,fontFamily system|serif|mono}; không CSS/url/font ngoại. Typography overrides ưu tiên appearance.titleFontSize, reset giữ default cũ. UI/card-overview-editor staging và ports; Canvas một commit, Detail Apply vào draft trước command chung. Native dialogSurface/anchorDialog dùng chung ngày và text. Edit lớn chỉ Markdown + nút popup; tags/màu ở Format. Transfer Update typography thuộc takeFormat, Add/export giữ nguồn.

## E016 — Uniform typography action

Checkbox copy cả profile title/summary/type tới toàn bộ card hiện có, không auto-sync hoặc default cho card mới. Graph uniformProfile resolve cấu hình source; applyUniformStyles chỉ copy typography và Fit size qua callback; app validate candidate trước onecommand. Detail pending batch thuộc WeakMap keyed draftOriginal, dirty/Cancel/recovery giữ đúng vòng đời; không ghi pending vào project JSON. Khi Fit lỗi một card thì bỏ cả candidate. anchorDialog tự clamp qua ResizeObserver để locale/textarea không làm action tràn viewport.

## E017 — Contextual Format/Edit

Detail/card-format-fields dựng markup thuần qua shared forms; editor-fields giữ Edit/relation/project. Context sync ở app chỉ toggle image/radius groups, không xóa cấu hình hidden; cover còn lưu vẫn cho quản lý để không mắc kẹt ref. Typography/titleFontSize UI ở popup duy nhất, tags pending array giữ literal comma nếu chưa edit; explicit edit string comma-delimited. Reset frame giữ APPEARANCE.titleFontSize legacy và namespace typography. AutoFit selector dùng một private fitDraftSize; không còn handler data-shape preset có thể bắt nhầm readonly preview. Same-tab restore caret/scroll/disclosures; new tab reset scroll. CSS inspector headings phải direct-child để không override card title và làm Fit đo sai.

Global typography uses explicit session values for title/summary/type (8-72px, local font and color), independent of selected card; bulk colors still use the selected card. Only checkboxes enter bulk action options; profile is a separate command argument. Native validation blocks invalid values before command; shared Fit/pin/Undo remains authoritative.
