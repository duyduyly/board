# Feedback01 — đợt4

User giao FB024–FB029 ngày2026-10-13. Đang triển khai; chưa final gate. Browser plugin not available: dùng repo Playwright Chrome/Edge/Firefox, localhost4173.

FB024 contract: 6 enum mới, triangle alias equilateral; shared safeArea/outline/hit/anchors/resize/Fit, concave không nhận CSS/path từ file. Core geometry/contract5/5 PASS. Right triangle dùng tâm polygon khi bounds center nằm trên/cạnh ngoài, tránh ray từ vùng ngoài hình.

Prototype browser3/3 PASS at zoom10%/400%, screenshot feedback-04-shape-prototype.png; safe area/anchor and14outlines.

Integration: shapes18/18 và extended font72/ảnh/2views3/3 PASS trên Chrome/Edge/Firefox. Star safeArea mở rộng0.28×0.28 đã kiểm4góc; title dài với ảnh có thể vượt bounds (guard giữdraft), ví dụ dùng overview ngắn. Mixed demo14shapes giữ Detail đầy đủ.

FB026: mixed-shapes-example14nodes, schema/types/AI Guide/download và README/development/AGENTS đồng bộ. Fixture mới bao phủ registry enums/ảnh và serialize stage, core52/52 PASS. Không thay JSON1.0 hoặc dependency.

FB027 full regression234/234 PASS Chrome/Edge/Firefox, no unexpected/flaky,6.7min; report feedback-01-phase4-browser.json. Core52/52; syntax/lint/architecture40modules, tsc --noEmit/tsconfig.modules, Prettier full, local vendor build PASS. Covers Gallery/modal/viewer, guards/drafts/undo, offline Markdown/node files, unsafe Markdown/Mermaid, opt-in recovery/no default storage, two-view shapes/images/font and radial/collapse. Desktop1440/1050 and Gallery mobile; editor mobile remains desktop notice.

FB028 first Card Overview202.8ms failed200ms threshold (first report retained). Palette rebuilt SVG/buttons for every selection; cache locale and update disabled only on lock change. No model cache, no content changes. Retest Card import905.7ms/Overview198.8ms/pan59.88FPS targets PASS. FB027 reopened for palette guard/locale recheck.

## Isolated benchmark

Chrome155.0.8059.40, Windows10.0.26200, i5-10300H,32GiB,1440×900;500nodes/2000relations,2,539,799bytes,14shapes,4kinds, embedded portrait/landscape images, font12/18/24/36/48/60/72, Markdown/Mermaid. Runs sequential, no UI suite during measurement. Commands: node scripts/benchmark-radial.mjs card feedback-01-phase4 --shapes, then mind.

| View | Import ms | Overview max/5 ms | Pan median FPS/10s | Radial preview ms | Apply ms | Overlap |
|---|---:|---:|---:|---:|---:|---:|
| Card |905.7|198.8|59.88|N/A|N/A|0|
| Mind |1164.5|122.3|59.88|634.1|835.6|0|

All fixed targets PASS (import≤3000ms,Overview≤200ms,pan≥45FPS,radial≤3000ms,no overlap). Card Overview remains close to threshold; report records5samples and machine. Mind layoutSpread warning expected for500nodes. Reports feedback-01-phase4-benchmark-card/mind.json with screenshots.

## Visual/limitations

Reviewed prototype14outlines and mixed-dark screenshot: palette14shapes, shared safe areas and images; Fit72 overview rendered without clipping. Fit does not run layout; resized neighbors may overlap until user moves/Arrange. Compact nodes preserve summary/tags/content in Detail. Long image+title can exceed1200×1000 limits, warning blocks Apply; shorten overview/reducefont. Mobile editor remains desktop notice; no new framework/dependency/network/storage policy.

Palette optimization affected-flow recheck51/51 PASS Chrome/Edge/Firefox (shapes/extended/radial guards+locks+locale+image+resize+history+two-view), report feedback-01-phase4-palette-recheck.json. Static/typecheck/format repeated PASS. Full234browser report remains separate.

## Final gate FB029

FB001–FB028 DONE với evidence; schema asset/runtime agree, legacy và mixed fixture validate/round-trip. Master và FBsubset đúng14columns/UTF8BOM/CRLF/uniqueIDs/knownacyclicdeps; evidence files tồn tại, dates/status hợp lệ. Full regression và post-optimization affected recheck đạt; benchmark fixedtargets cả2views đạt. FB029 DONE; không blocker triển khai. Existing10BACKLOG ngoài phạm vi giữ nguyên. Không publish hosting.
