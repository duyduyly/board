# Illustrated Mind Map — đợt 2

2026-10-12. MM013–MM020 DONE; nghiệm thu ngày2026-10-12.

## Scope và quyết định

User đã giao MM013–MM020. Giữ JSON1.0 và namespaces đã có; không dependency mới. Layout thuần, stable ID order, leaf weights theo bbox, sector + depth rings có clearance theo diagonal. Node ngoài Root là forest riêng đóng gói bên cạnh. Preview session cô lập, Apply một command; Cancel và switch khôi phục viewport/session trước preview. Preview khóa mutations/selection để không commit tọa độ tạm; locale/theme/Fit/zoom dùng được. Collapse session, không export hoặc recovery; full graph luôn export. Search/Focus/relation navigation mở ancestors để selection/Detail không trỏ node ẩn.

Browser plugin not available; dùng skill frontend-testing-debugging và Playwright của repo như đợt 1.

## MM013 prototype

node scripts/prototype-radial.mjs: naive4 overlaps, bbox rings0 overlaps trên mixed fixture. Report planning/mind-map-radial-prototype.json; vector fixture planning/design/radial-prototype.svg. Chọn weighted sectors + bbox depth rings, forest packing; không dùng force simulation. Quyết định ghi trước module runtime.

## MM014 core

node --test tests/radial-core.test.mjs:4/4 pass. Mixed fixture deterministic/reorder/input preservation/reference independence; star/chain/balanced500nodes mixed bbox non-overlap; Apply atomic undo/redo/roundtrip; missingRoot rejection. No force simulation or new schema.

## MM015/MM016 interaction checks

Chrome radial.spec.mjs6/6 pass. Preview/Reset/Cancel/Apply, undo/redo, no-op Apply, model/Card Map preservation, draft guard, view-switch cancellation, mutation/drag/export lock, Escape, collapse count/incident references, search reveal, selection redirect, full graph export and session-only reload. Found no-op Apply initially kept preview open; fixed and reran6/6. Screenshots radial-preview-dark.png and radial-applied-dark.png.

## MM017 UX

Chrome radial8/8 pass: keyboard collapse/aria vi/en, Escape kể cả khi locale focus,1050 preview không tràn, mobile390 desktop notice, recovery không persist collapse và relation Focus mở endpoints. Images: radial-preview-1050.png/radial-light-1050.png. Core phát hiện exported() còn baseline theo một viewport thay vì cả map; sửa để viewChanged sạch sau export. Docs visibility Cytoscape3.34.3: https://js.cytoscape.org/#style/visibility .

## MM018 regression và kiểm tra logic

Core33/33 pass (5 radial +28 existing); lint/typecheck/format/build pass ngày2026-10-12. Full matrix đầu143/144: Edge missingRoot test chọn view trước khi async example replacement hoàn tất. Sửa test chờ fixture card-user-api; Edge8/8 pass. Code sản phẩm không cần thay cho race test này. Full matrix cuối147/147 PASS trên Chrome/Edge/Firefox sau tối ưu dense-edge rendering; report mind-map-phase2-full-results.json.
Core tìm thêm collapse session chưa reset trong replace(); đã sửa, test gồm replace/export viewport baselines, collapse clear và spread warning.

## MM019 benchmark

Lệnh: node scripts/benchmark-radial.mjs mind, rồi card; không chạy browser suite đồng thời. Chrome154.0.8037.98, Windows11 build26200, i5-10300H,32GiB,1440×900. Fixture500nodes/2000relations, raster portrait/landscape,2.50MB,4kinds,branch forest +references. Mind: import1021.1ms,Overview max106.5ms,layout preview647.3ms,Apply602.4ms,0overlap,pan median59.88FPS. Card: import707.8ms,Overview172.4ms,pan59.88FPS. Card layout timings là two-frame baseline, không chạy radial layout.

Ban đầu pan chỉ20FPS sau radial; diagnostic bỏ HTML không cải thiện, ẩn edges đạt60FPS. Renderer giờ hoãn vẽ edges khi đang pan/zoom/drag nếu ≥1000edges, khôi phục160ms idle; graph/session/model không bị thay đổi. Labels quá nhỏ dưới8px không render. Không giảm target. Diagnostic code đã xóa; texture/transform experiments không giữ. Benchmark screenshot chờ250ms để chụp edges đã khôi phục. Reports: mind-map-phase2-benchmark-mind.json/card.json, ảnh radial-benchmark-mind.png/card.png.

Giới hạn: layout có thể rất rộng với500nodes (layoutSpread warning); cần zoom/Focus/thu nhánh để đọc. Không bảo đảm mọi reference curve tránh node khác; không tự layout khi import/switch. Node/relations đầy đủ trong export, collapse chỉ trong phiên.

## MM020 release gate

MM001–MM020 DONE; master85tasks:75DONE,10BACKLOG,0TODO/IN_PROGRESS/BLOCKED. Master/subset UTF-8 BOM/CRLF/14columns, IDs unique, dependencies tồn tại/acyclic; completed_at chỉ DONE. Core33/33; UI147/147,49/browser; lint/typecheck/format/build và diff whitespace pass. Benchmark cả hai view đạt targets; docs/spec/README/Format Guide/AGENTS đồng bộ. Không backend/CDN mới, không tự persistence, collapse không export/recovery. Không thực hiện B104/B201/BACKLOG. Entry vẫn index.html +assets. Screenshot visual QA dark/light/1050 và benchmark edges đã khôi phục. Local commit được thực hiện theo yêu cầu user trước đó; không push remote.
