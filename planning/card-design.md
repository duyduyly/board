# Thiết kế Card và ảnh Detail — E005

Card chỉ hiển thị type, title, summary và tags. Badge ở trên trái, nút ↗ trên phải mở Detail Overview. Double click cũng mở Overview; nội dung đầy đủ, Markdown, Mermaid, bảng và ảnh nằm trong Detail.

Title 14–15 px, weight 600, tối đa 2 dòng; summary 11–12 px, line-height 1.4–1.5, tối đa 3 dòng; badge và tags 9–10 px. Padding 14–16 px; khoảng cách badge/title 8 px, title/summary 6 px, summary/tags 12 px. Tags có nền/border nhẹ, title và summary dài được ellipsis.

Dark mode: nền Canvas #2a342e, card #232d27 có tint theo màu card, border xanh/xám nhẹ, radius 8–10 px, shadow rất nhẹ. Hover sáng border và hiện handle rõ hơn; selected dùng accent border và glow nhẹ. Light mode giữ hierarchy và tương phản phù hợp. Handle nhỏ, mờ khi bình thường, sáng/lớn hơn khi hover.

Card mới và card thiếu size mặc định 260 × 190 px. Ví dụ cập nhật cùng chiều cao; JSON có size riêng vẫn giữ nguyên. Số quan hệ chỉ ở tooltip nút mở để card gọn.

Ảnh Detail: hover hoặc focus mở preview nổi ngoài panel, hiển thị đúng naturalWidth/naturalHeight 100% theo CSS pixel; không thu nhỏ ảnh lớn. Khung giới hạn trong viewport và cuộn ngang/dọc. Di chuột ra ngoài, nút × hoặc Escape đóng preview; Escape không rerender Detail làm ảnh bật lại. Đổi selection/theme/tab hoặc cuộn panel đóng preview. Không thay project, history hay dirty.
