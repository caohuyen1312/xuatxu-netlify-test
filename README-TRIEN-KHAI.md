# XuatXu – bản chuyển đổi Flask sang Netlify (bản thử nghiệm)

## Thành phần
- `public/index.html`: giao diện gốc, giữ nguyên JavaScript gọi `/api/...`.
- `public/static/`: CSS, ảnh và trang credits gốc.
- `netlify/functions/api.mjs`: API JavaScript cho tra cứu, QR, hỏi đáp dựa CSV, mô phỏng SHA-256, góp ý.
- `netlify/functions/data.mjs`: bộ dữ liệu CSV được chuyển sang JavaScript khi tạo gói.
- `netlify.toml`: cấu hình Netlify; chức năng `api.mjs` tự đăng ký đường dẫn `/api/*` bằng `export const config`.

## Chạy thử trên Windows PowerShell
1. Giải nén bộ ZIP này thành một thư mục **mới** (không ghi đè bản Flask).
2. Mở PowerShell trong thư mục có `package.json` và `netlify.toml`.
3. Cài Node.js LTS nếu chưa có: https://nodejs.org
4. Chạy `npm install`.
5. Chạy `npx netlify-cli dev` và mở URL được in ra (thường là http://localhost:8888).
6. Kiểm tra `http://localhost:8888/api/init`, sau đó tra cứu sản phẩm, chi tiết, hỏi đáp, QR, kiểm tra SHA-256.
7. Chức năng gửi góp ý dùng Netlify Blobs, **cần chạy trên Netlify có quyền lưu trữ hợp lệ**; local chưa kết nối site có thể trả 503. Giới hạn miễn phí/giá có thể thay đổi.

## Kiểm tra nhanh trước deploy
- GET `/api/init` phải trả `success:true` và có 9 products.
- GET `/api/product-detail/P-ENVY-VICHI-01` phải trả 1 sản phẩm.
- GET `/api/generate-qr?product_id=P-ENVY-VICHI-01` phải trả ảnh PNG.
- POST `/api/ai/ask` JSON `{ "question": "Xuất xứ của táo ENVY?" }` trả một câu giải thích có nguồn.
- GET `/api/tech-demo` phải có 5 bản ghi hash.
- POST `/api/tech-demo/verify` JSON `{}` phải trả `is_valid:true`.
- POST `/api/feedback` JSON `{ "product_id":"P-ENVY-VICHI-01", "comment":"Thử nghiệm" }`: kiểm tra sau khi triển khai và thiết lập Blobs.

## Đưa lên Netlify an toàn
Khuyến nghị tạo một **Netlify site mới để thử**, không cập nhật site đang chạy ngay:
1. Tạo GitHub repository **mới** (Private), chỉ tải nội dung thư mục ZIP này lên, không lấy các thư mục `.git` cũ.
2. Netlify → Add new project → Import from Git → chọn repo thử nghiệm.
3. Build: `npm install`, Publish directory: `public`, Functions: `netlify/functions` (các giá trị đã nằm trong `netlify.toml`).
4. Deploy và kiểm tra từng chức năng; xem Function logs nếu API lỗi 500.
5. Chỉ khi đạt yêu cầu mới thay thế dự án chính hoặc chuyển tên miền cũ.

## Giới hạn đã biết
- Chưa xác nhận chạy thực tế trên hạ tầng Netlify; các API đọc dữ liệu và SHA-256 đã được chạy thử ở Node.js cục bộ. Chức năng QR cần cài `qrcode`; Blobs cần môi trường Netlify.
- Hỏi đáp JavaScript giữ cấu trúc dữ liệu và cách chọn câu hỏi/tri thức gần với Flask, nhưng cần kiểm thử thủ công vì đây là bản viết lại logic.
- Góp ý dùng Netlify Blobs với từng key để tránh ghi đè khi nhiều người gửi. Chưa có CAPTCHA và rate limiting; cần bổ sung trước khi mở rộng người dùng thực.
- Không có AI mô hình ngôn ngữ bên ngoài; phần hỏi đáp dựa bộ CSV của dự án gốc.
- Chưa kiểm thử giao diện trên nhiều trình duyệt, kiểm thử sản phẩm đầy đủ hoặc bảo đảm thời gian đáp ứng/chi phí. Netlify Functions có thể có cold start và giới hạn theo gói, khác cơ chế ngủ 15 phút của Render.
- CSV nguồn được đóng gói tại thời điểm tạo mã. Khi sửa CSV phải tạo lại `data.mjs` hoặc xây quy trình import.
- Ảnh và nội dung giữ nguyên theo dữ liệu được gửi; quyền sử dụng hình ảnh cần người sở hữu kiểm tra.
