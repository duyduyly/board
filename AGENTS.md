# Hướng dẫn agents cho Visual Card Graph Editor

## Mục tiêu và cấu trúc dự án

Triển khai V1 của JSON-driven Visual Card Graph Editor theo plan và checklist, kiểm chứng và cập nhật tiến độ liên tục đến khi phạm vi người dùng giao hoàn thành. Không có backend/account/auto-persistence trong V1.

Entry ứng dụng bắt buộc: index.html ở gốc repository. CSS, JavaScript, dictionaries vi/en và tài nguyên nằm trong assets/. Không đổi sang app entry ở src/ hoặc public/. planning/ chỉ chứa kế hoạch, checklist và bằng chứng triển khai. V1 đã triển khai tại index.html và assets/. Khi tiếp tục phát triển, đọc trạng thái hiện tại và evidence trong planning/ trước khi chọn task; không tự bắt đầu các mục BACKLOG.

## Đọc trước khi thay đổi

1. Đọc yêu cầu mới nhất của người dùng; yêu cầu này ưu tiên hơn tài liệu cũ.
2. Đọc planning/implementation-plan.md đầy đủ để hiểu phạm vi và quy tắc triển khai.
3. Đọc planning/implementation-checklist.csv để biết trạng thái thực, dependencies, acceptance và evidence.
4. Đọc wordspace/docs/json-driven-visual-card-graph-editor-spec-v2.md cho các mục liên quan và wordspace/docs/visual-card-graph-example.json cho format.
5. Đọc code và evidence hiện có; không giả định TODO nghĩa là chưa có code hoặc DONE nghĩa là đã kiểm chứng đúng. Báo cáo đánh giá ban đầu tại project-context/business/visual-card-graph/visual-card-graph-analysis.md chỉ là lịch sử, không ghi đè các quyết định nâng cấp mới.

Nếu tài liệu xung đột: ưu tiên yêu cầu người dùng mới nhất, rồi plan hiện hành, rồi spec v2, rồi spec gốc. Checklist ghi tiến độ và acceptance; không dùng một dòng checklist để âm thầm sửa nghiệp vụ. Đồng bộ plan/spec/checklist khi thay yêu cầu. Tự quyết định chi tiết kỹ thuật trong phạm vi; chỉ hỏi khi mâu thuẫn làm thay đổi ý định sản phẩm mà không thể suy ra.

## Vòng làm việc cho từng task

1. Chọn task trong phạm vi hiện được giao, có dependencies DONE và không có blocker thực tế. Ưu tiên V1; V1.1/V2 giữ BACKLOG trừ khi người dùng yêu cầu.
2. Kiểm tra code đã tồn tại, điền owner và đặt status IN_PROGRESS trước khi code. Giữ ID ổn định; không reset trạng thái task khác.
3. Implement theo scope/acceptance. Giữ root index.html + assets, model độc lập renderer, commands atomic và UI song ngữ.
4. Chạy verification tương ứng. Không đánh dấu DONE nếu chỉ mới viết code hoặc môi trường chưa cho phép kiểm tra bắt buộc.
5. Ghi evidence cụ thể (commit/PR nếu có, hoặc đường dẫn report với lệnh, kết quả, ngày và browser khi cần); ghi completed_at yyyy-mm-dd; rồi đặt DONE. Không tạo commit hoặc publish chỉ để có evidence nếu người dùng chưa yêu cầu.
6. Cập nhật plan nếu có quyết định triển khai, cập nhật checklist ngay sau thay đổi trạng thái và tiếp tục task sẵn sàng tiếp theo cho tới khi phạm vi được giao hoàn tất.
7. Nếu chưa thể tiếp tục một task, dùng BLOCKED cùng lý do, kiểm tra còn công việc độc lập để làm. Không tuyên bố V1 DONE khi còn TODO/IN_PROGRESS/BLOCKED trong V1.

Khi lượt làm việc kết thúc hoặc chuyển phiên, để lại mục Tiến độ hiện tại trong plan: task đã hoàn tất, task đang dở, files đã đổi, checks đã chạy, blockers và task tiếp theo. Đây là thông tin tiến độ, không thay thế CSV. Không tự thực hiện code khi người dùng chỉ đang yêu cầu sửa plan/tài liệu.

## Quy tắc cập nhật CSV

- Giữ UTF-8 BOM, dấu phẩy, CRLF, header và 14 cột hiện có; quote/escape cell đúng CSV. Dependencies trong một cell dùng dấu chấm phẩy.
- Các status hợp lệ: TODO, IN_PROGRESS, BLOCKED, DONE, BACKLOG. Chỉ task DONE có completed_at. DONE phải có evidence phù hợp acceptance.
- Không đổi ID hoặc renumber khi thêm task. Thêm dependency mới không tạo cycle; release gate phải bao gồm task V1 mới.
- Sau chỉnh CSV: đọc lại, kiểm tra đủ cột, ID unique, dependency tồn tại/không cycle, counts/trạng thái phù hợp plan. Bảo toàn thay đổi người dùng và agent khác.
- Nếu scope task DONE thay đổi, mở lại task bị ảnh hưởng hoặc tạo task bổ sung có trace, không giữ DONE cho acceptance chưa đạt.

## Quy tắc kỹ thuật và tiếng Việt/Anh

- Default vi, có switch Tiếng Việt / English trên toolbar; dictionaries trong assets/js/i18n/. Tất cả UI do ứng dụng cung cấp dùng translation keys, gồm error/dialog/aria labels và Format Guide.
- Switch không reload, mất draft hoặc thay project/history/dirty. Không dịch user content, JSON keys/IDs/enums. Locale chỉ memory phiên và không export.
- File JSON hợp đồng 1.0; giữ extensions; import stage+validate trước replace. Không âm thầm bỏ dữ liệu lỗi hoặc unknown fields ngoài contract.
- Project Model là nguồn dữ liệu đang làm việc. Selection/panel/draft/history là session; renderer adapter không trở thành format file.
- Mọi mutation đi qua commands/transactions; delete cascade, connector-create và editor Apply phải undo nguyên khối.
- Không upload project, analytics nội dung, runtime CDN, project localStorage/IndexedDB hoặc recovery ngầm. Nội dung Markdown/Mermaid phải theo policy của spec.
- Prototype quyết định library và tooling; không áp đặt framework làm thay cấu trúc người dùng chọn. Kiểm tra docs chính thức khi triển khai dependencies và ghi version.

## Kiểm chứng và báo cáo

Test phần logic có hậu quả; dùng browser cho interaction/visual QA. Kiểm tra vi/en, guards, round-trip, unsafe content, network/storage và benchmark theo checklist. Chạy checks cần thiết tương ứng thay đổi; không tạo tests chỉ sao chép implementation.

Trước tuyên bố hoàn thành V1: mọi task release V1 DONE có evidence, các checks/release gate pass, benchmark được ghi và không có blocker chưa giải quyết. Không tự chuyển BACKLOG thành nhiệm vụ bắt buộc hoặc tự publish.

Báo cáo ngắn cho người dùng: kết quả, task IDs hoàn tất, checks đã chạy, hạn chế/blockers và phần còn lại. Phải phân biệt đã code, đã test và chỉ mới có đề xuất. Nếu tool lỗi thì ghi trạng thái thực và tiếp tục phần có thể làm; không bịa evidence.

## Bổ sung policy E006/E007 theo yêu cầu nâng cấp của user

User đã yêu cầu cải thiện trải nghiệm viết tài liệu sau review. Fulltext search, writing mode, draft preview, TOC, template append và Markdown download được phép. Persistence mặc định vẫn tắt; **recovery opt-in** được phép trong IndexedDB, marker bật trong localStorage, UI giải thích rõ và tắt/xóa. Không upload/backend. Điều này thay thế các câu cấm tuyệt đối local persistence ở phần V1 cũ chỉ trong phạm vi recovery opt-in. Giữ JSON 1.0/giới hạn và commands/history; snapshot khôi phục không gồm history.

## Kế hoạch Illustrated Mind Map và node ảnh

Khi triển khai yêu cầu này, đọc thêm [planning/mind-map-plan.md](planning/mind-map-plan.md) và các task MM001–MM020 trong checklist chính. [planning/mind-map-checklist.csv](planning/mind-map-checklist.csv) là bản trích: cập nhật implementation-checklist.csv trước rồi tái tạo bản trích để tránh lệch trạng thái. Giữ graph/Detail dùng chung và geometry theo view; chốt contract tại MM001 trước code. B104/B201 vẫn BACKLOG ngoài phạm vi đã tách. User đã giao cả đợt 1 và đợt 2 MM001–MM020 ngày 2026-10-12. Tiếp tục theo dependencies và evidence; B104/B201 ngoài phần đã tách vẫn BACKLOG.

## Kiến trúc source sau refactor

Đọc [docs/development.md](docs/development.md) và [planning/refactor-plan.md](planning/refactor-plan.md) trước khi mở rộng. Module thấp không import app;common không import domain/UI. Dùng shared forms/feedback/download vàprojectIndex cho committed snapshot,không mutate cached Maps hoặc dùng cache trong mutator. Canvas/preview dùngapplyAppearance chung;CSS giữ base→theme→workspace. npm run check bắtcycles/upwardimports/unused;typecheck gồmcontract vàtyped common/query modules.

## Kế hoạch nâng cấp Feedback 01

Đọc planning/feedback-01-plan.md và FB001–FB029 trong implementation-checklist.csv khi triển khai Gallery, modal Detail, click image viewer, offline node exchange, shapes hoặc resize/font. planning/feedback-01-checklist.csv là bản trích: cập nhật master trước rồi tái tạo. User đã giao đợt 1 ngày 2026-10-12; chỉ implement các đợt được giao, không tự code từ TODO của đợt sau. Khi được giao từng đợt, tuân thủ contract/prototype/gates, giữ root index.html + assets và các guards/history/vi-en. Existing BACKLOG ngoài scope giữ nguyên.

User giao Feedback01 đợt1 FB001–FB010 ngày2026-10-12. Đợt2–4 FB011–FB029 chưa được giao implement. Khi kiểm tra UI, Home Gallery và native Detail modal thay welcome/right-panel cũ; dùng visible controls/project tools, đóng Detail trước drag/connector/collapse trên Canvas. Evidence đợt1: planning/feedback-01-phase1-evidence.md.
