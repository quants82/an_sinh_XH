# Hệ thống Quản lý An sinh Xã hội số cấp Xã

Web App chuyên nghiệp xây dựng bằng **Next.js (App Router) + PostgreSQL + Google Drive API**, phục vụ quản lý tập trung các nhóm đối tượng yếu thế, chấm điểm ưu tiên 3 lớp, lọc danh sách hỗ trợ minh bạch và sao lưu dữ liệu an toàn.

## Kiến trúc
- **Ứng dụng & Database (Vercel + Neon/Vercel Postgres):** Giao diện phản hồi đa thiết bị (PC + Điện thoại trưởng thôn), xử lý chấm điểm, phân quyền RBAC + phạm vi thôn, nhật ký sửa từng trường (`audit_logs`) và khóa kỳ dữ liệu.
- **Kho tệp & Sao lưu (Google Drive):** Lãnh đạo kết nối tài khoản Google Drive lần đầu qua OAuth2 (`refresh_token` mã hóa AES-256-GCM). Hệ thống tự tạo cây thư mục `AN_SINH_XA_<MA_XA>` gồm `01_HoSo_MinhChung`, `02_DotHoTro_DaKhoa`, `03_BaoCao_ThongKe`, `04_SaoLuu_HeThong`.
- **Chạy local không cần cài PostgreSQL:** Khi không có biến môi trường `DATABASE_URL`, ứng dụng tự động dùng PostgreSQL nhúng (`@electric-sql/pglite`) lưu tại `.data/pglite`.

## Chạy trên máy cá nhân (Local)
```bash
npm install
npm run dev
```
Mở `http://localhost:3000` — hệ thống tự mở trang Khởi tạo Lãnh đạo chủ quản (`OWNER`) lần đầu.

## Triển khai lên Vercel + Google Drive
1. Push mã nguồn lên GitHub (`https://github.com/quants82/an_sinh_XH`).
2. Trên **Vercel**, chọn **Add New Project** từ repo GitHub và gắn thêm **Postgres (Neon / Vercel Postgres)** để tự sinh biến `DATABASE_URL`.
3. Thêm các biến môi trường (Environment Variables) trên Vercel:
   - `APP_SECRET`: Chuỗi bí mật ngẫu nhiên (tối thiểu 32 ký tự).
   - `GOOGLE_CLIENT_ID` và `GOOGLE_CLIENT_SECRET`: Tạo miễn phí tại Google Cloud Console (bật **Google Drive API**, thêm Authorized redirect URI là `https://<ten-mien-vercel>/api/drive/callback`).
   - `GOOGLE_REDIRECT_URI`: `https://<ten-mien-vercel>/api/drive/callback`
   - `NEXT_PUBLIC_APP_URL`: `https://<ten-mien-vercel>`
4. Deploy và truy cập trang web lần đầu để khởi tạo Lãnh đạo chủ quản + bấm **"Kết nối Google Drive"**.
