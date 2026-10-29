# Design Styles — mỗi group là một thiết kế

## Thư viện theo giao diện hiện tại

Note Board và Mind Map dùng chung dữ liệu nhưng có bố cục riêng. Các mẫu cơ bản đã dùng Note paper vuông 260px; các nhóm học tập bên dưới giữ bố cục chuyên biệt để đọc và so sánh. Chỉnh chữ/tags/card/mũi tên trong sidebar **Định dạng**; nhấp đúp để mở Markdown. Bấm **Chuyển sang Mind Map** và chọn note gốc nếu muốn tự tạo nhánh từ Note Board.

Nhóm **Mind Map** trong thư viện mở trực tiếp ba mẫu: học qua ảnh (mẫu Mind Map hiện có), [Bản đồ kiến thức](../assets/data/templates/mind-knowledge.json) và [Kế hoạch dự án](../assets/data/templates/mind-project.json). Các mẫu mới có ba nhánh chính, Markdown để điền và ví dụ code JSON có tô màu.

Tái tạo toàn thư viện và ảnh xem trước: chạy `node scripts/generate-showcase.mjs`, sau đó `node scripts/refresh-template-library.mjs`. Generator thứ hai quản lý hai mẫu Mind Map mới, hình học Mind độc lập, hướng dẫn thao tác và thumbnail local. File Learning Atlas gốc ngoài repo không bị sửa; bản trong thư viện được cập nhật theo UI mới.

Mở Gallery → Bộ mẫu đầy đủ hoặc Import [JSON](../assets/data/showcase-example.json). Bộ mẫu có 6 bố cục độc lập, không có đường nối xuyên group. Zoom vào từng khu để đọc; kéo header khung để di chuyển cả thiết kế. Card ghim trong Zigzag Sprint giữ nguyên vị trí.

| Group | Ngôn ngữ thiết kế | Cách dùng đường nối |
| --- | --- | --- |
| Spaced Study Plan | Sage, mục tiêu → học → ôn sau → áp dụng | Straight theo tiến trình học |
| Concept & Comparison Map | Xanh kỹ thuật, so sánh khái niệm có quan hệ rõ | Orthogonal với nhãn triển khai/cân nhắc |
| Worked Example → Try | Kem ấm, lời giải → giải thích → tự làm → biến thể | Straight theo mức độ tự chủ |
| Cornell Study Lab | Giấy sáng, chữ căn trái, câu hỏi / ghi chú / tự kiểm tra / lịch ôn | Straight dẫn bước học, orthogonal dẫn xuống lịch ôn |
| Closed-book Recall Map | Lavender, câu hỏi ngắn trên các khối chữ dễ đọc | Curved tỏa từ câu hỏi trung tâm |
| Mistake → Feedback → Retry | Teal, giữ lỗi gốc, sửa và thử lại | Zigzag theo các vòng sửa lỗi |

37 card/20 relation. Cả6group đã chuyển sang mẫu học tập sau rà soát phương pháp. Group04 là Cornell, câu hỏi trên Canvas và đáp án trong Detail. Xem [nghiên cứu và hướng dẫn](study-notes-research.md). Mẫu ảnh có trong project Mind Map riêng ở Gallery. Card/Mind Map có geometry sẵn và không nối xuyên group. Bộ này ưu tiên tính hữu ích khi học, không còn cố nhét đủ mọi shape/Format vào mẫu.

## Hướng dẫn cho Agent

Chọn **một ngôn ngữ thiết kế phù hợp nội dung**, không trộn mọi loại shape vào mỗi group. Giữ palette, font, hướng đọc và khoảng cách nhất quán. Dùng shape để thể hiện vai trò, không chỉ để trang trí. Chọn route theo bố cục; các route chưa tự tránh vật cản.

Nhân bản cả group, tạo IDs duy nhất và cập nhật cardIds/relations/Mind Map positions/sizes. Frame bounds tự tính, không ghi vào JSON. Mỗi card tối đa một group; thả card vào frame không tự đổi membership. Giữ chữ ngắn ở các hình hẹp/lõm; đưa chi tiết vào Markdown. Chỉ ghim thành phần cần đứng yên.

Đọc [schema](../assets/data/project.schema.json); giữ JSON1.0, giới hạn500cards/2000relations/10MiB/100000ký tự content mỗi card. Không CSS/path tùy ý, không session/history/locale trong JSON. Ảnh dùng attachment nhúng có ID hợp lệ, không tài nguyên mạng. Import kiểm tra, xem cả hai view, chỉnh chồng lấn rồi Export.

Prompt tham khảo: “Dựa trên group Cornell Study Lab trong showcase-example.json, tạo bài học về [chủ đề]. Viết câu hỏi có thể tự kiểm tra, đáp án và giải thích trong Detail; không lộ đáp án ở card câu hỏi. Thêm ví dụ tự làm, mục lỗi sai và lịch ôn thủ công. Mỗi group có một mục đích học, bố cục nhất quán. Chỉ trả JSON1.0 hợp lệ theo project.schema.json.”

Tái tạo: `node scripts/generate-showcase.mjs`. Đây là bộ bố cục tham chiếu, không còn là bảng liệt kê từng tùy chọn Format. Các chức năng như Undo/search/recovery là thao tác ứng dụng.
