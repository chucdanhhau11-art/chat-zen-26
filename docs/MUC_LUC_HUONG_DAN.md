# 📖 MỤC LỤC — HƯỚNG DẪN SỬ DỤNG (Chim Cu Gáy)

1. [Tổng quan](#1-tổng-quan)
2. [Hệ thống Role & Quyền hạn](#2-hệ-thống-role--quyền-hạn)
3. [Bảng quyền chi tiết theo dữ liệu](#3-bảng-quyền-chi-tiết-theo-dữ-liệu)
4. [Các trang quản trị & địa chỉ truy cập](#4-các-trang-quản-trị--địa-chỉ-truy-cập)
5. [Hướng dẫn tính năng người dùng](#5-hướng-dẫn-tính-năng-người-dùng)
6. [Hệ thống Bot — công dụng & cách dùng](#6-hệ-thống-bot--công-dụng--cách-dùng)
7. [Bot API cho lập trình viên](#7-bot-api-cho-lập-trình-viên)
8. [Câu hỏi thường gặp / Xử lý sự cố](#8-câu-hỏi-thường-gặp--xử-lý-sự-cố)

---

## 1. Tổng quan

Ứng dụng nhắn tin thời gian thực (giống Telegram) gồm:

- Chat 1-1, nhóm, kênh; gửi file/ảnh/voice; reaction; trả lời; ghim; thu hồi.
- Gọi thoại/video P2P (WebRTC).
- Kết bạn, danh bạ, chặn người dùng, Saved Messages.
- Hệ thống Bot (BotFather, Bot API, Inline Bot, Mini App).
- Khu vực quản trị dành cho Admin.

Backend chạy trên Lovable Cloud: cơ sở dữ liệu Postgres + Auth + Storage + Realtime + Edge Functions. Mọi bảng đều bật RLS (Row Level Security), nên quyền xem/sửa dữ liệu được cưỡng chế ở tầng cơ sở dữ liệu, không phụ thuộc giao diện.

---

## 2. Hệ thống Role & Quyền hạn

Role được lưu ở bảng riêng `user_roles` (không lưu trong profile để tránh leo thang đặc quyền) và kiểm tra qua hàm `has_role(user_id, role)`.

Thứ tự từ cao xuống thấp:

### 2.1. `super_admin` — Quản trị tối cao

Quyền:
- Toàn quyền trên hệ thống role: cấp/thu hồi `admin`, `user` cho bất kỳ ai.
- Xem và xoá **mọi** cuộc trò chuyện, thành viên, tin nhắn (kể cả nhóm không tham gia).
- Xem toàn bộ danh sách người dùng, duyệt/từ chối/khoá tài khoản.
- Bật/tắt chế độ tự động duyệt đăng ký.
- Sửa cấu hình hệ thống (`app_settings`).

Ghi chú: đây là vai trò kỹ thuật cấp cao nhất, chỉ nên có 1–2 tài khoản.

### 2.2. `admin` — Quản trị viên

Quyền:
- Truy cập Admin Dashboard và Admin Portal.
- Duyệt / từ chối / khoá (ban) tài khoản đăng ký mới.
- Tạo tài khoản mới trực tiếp (kèm chọn role khi tạo).
- Bật/tắt “Tự động duyệt đăng ký”.
- Xem thống kê hệ thống (số người dùng, số nhóm, số tin nhắn…).
- Xem và sửa cấu hình `app_settings`.
- Xoá thành viên khỏi nhóm khi cần xử lý vi phạm.

Không có: đổi role của người khác thành admin/super_admin (chỉ `super_admin` làm được), và không đọc được nội dung tin nhắn của nhóm mình không tham gia.

### 2.3. `user` — Người dùng thường (mặc định khi đăng ký)

Quyền:
- Nhắn tin trong các cuộc trò chuyện mình là thành viên.
- Tạo nhóm, mời thành viên, rời nhóm; nếu là **chủ nhóm** thì đổi tên/ảnh nhóm, xoá nhóm, nhường quyền nhóm trưởng.
- Kết bạn, huỷ kết bạn, chặn/bỏ chặn, sửa hồ sơ cá nhân.
- Tạo và quản lý **bot của chính mình**.
- Không nhìn thấy bất kỳ mục quản trị nào (menu admin bị ẩn hoàn toàn).

### 2.4. Vai trò trong từng nhóm (khác với role hệ thống)

| Vai trò nhóm | Quyền |
|---|---|
| `owner` (nhóm trưởng) | Đổi tên/ảnh/mô tả, thêm–xoá thành viên, phong admin nhóm, nhường quyền, xoá nhóm |
| `admin` (quản trị nhóm) | Thêm thành viên, ghim tin, xoá tin vi phạm |
| `member` | Gửi/nhận tin, reaction, rời nhóm |

---

## 3. Bảng quyền chi tiết theo dữ liệu

| Dữ liệu | user | admin | super_admin |
|---|---|---|---|
| Hồ sơ của mình | Xem + sửa | Xem + sửa | Xem + sửa |
| Hồ sơ người khác | Chỉ xem | Chỉ xem | Chỉ xem |
| Tin nhắn nhóm mình tham gia | Xem, gửi, sửa/xoá tin của mình | Như user | Xem + xoá mọi tin |
| Tin nhắn nhóm không tham gia | Không | Không | Xem + xoá |
| Danh sách thành viên nhóm | Chỉ nhóm của mình | Chỉ nhóm của mình | Tất cả |
| Danh sách tài khoản hệ thống | Không | Có | Có |
| Duyệt / từ chối / khoá tài khoản | Không | Có | Có |
| Cấp role | Không | Không | Có |
| Cấu hình hệ thống (`app_settings`) | Chỉ đọc | Đọc + ghi | Đọc + ghi |
| Bot | Chỉ bot mình sở hữu | Bot mình sở hữu | Tất cả |

---

## 4. Các trang quản trị & địa chỉ truy cập

| Đường dẫn | Ai vào được | Dùng để làm gì |
|---|---|---|
| `/` | Mọi tài khoản đã đăng nhập | Màn hình chat chính |
| `/auth` | Khách | Đăng nhập / Đăng ký |
| [`/admin-portal`](https://chat-zen-26.lovable.app/admin-portal) | Chỉ `admin`, `super_admin` | Cổng quản trị chuyên dụng: duyệt đăng ký mới, bật/tắt “tự động duyệt”. Mở nhanh bằng **Ctrl + Click** vào nút Đăng nhập/Đăng ký ở trang `/auth` |
| [`/admin`](https://chat-zen-26.lovable.app/admin) | Chỉ `admin`, `super_admin` | Admin Dashboard: thống kê, danh sách người dùng, tạo tài khoản, khoá tài khoản, quản lý quyền |
| `/bots` | Mọi tài khoản | Bot Dashboard: quản lý bot do chính mình tạo |

Nguyên tắc bảo mật: các trang trên đều kiểm tra role ở phía máy chủ (Edge Function `manage-user` xác thực token và role trước khi thao tác). Việc gõ tay URL `/admin` khi không phải admin sẽ bị chặn.

### Luồng duyệt đăng ký

1. Người dùng đăng ký tại `/auth`.
2. Nếu **Tự động duyệt = TẮT** → tài khoản nằm ở hàng chờ, admin vào `/admin-portal` bấm **Duyệt** hoặc **Từ chối**.
3. Nếu **Tự động duyệt = BẬT** → mọi tài khoản tạo từ thời điểm bật trở đi được duyệt ngay, đăng nhập được luôn.

---

## 5. Hướng dẫn tính năng người dùng

- **Tạo nhóm mới**: menu ☰ → “Tạo nhóm mới” → đặt tên → chọn thành viên.
- **Danh bạ**: menu ☰ → “Danh bạ” → xem bạn bè, tìm kiếm, xử lý lời mời kết bạn đang chờ.
- **Cài đặt**: menu ☰ → “Cài đặt” → chỉnh sửa hồ sơ, đổi giao diện sáng/tối, quản lý bot, danh sách người đã chặn.
- **Saved Messages**: luôn ghim ở đầu danh sách, dùng làm kho ghi chú cá nhân.
- **Tìm người dùng**: gõ tên/username/số điện thoại vào ô tìm kiếm rồi nhấn Enter.
- **Xem hồ sơ**: bấm biểu tượng con mắt → cửa sổ hồ sơ có các nút Kết bạn / Huỷ kết bạn / Nhắn tin / Chặn. Huỷ kết bạn và Chặn đều yêu cầu xác nhận trước khi thực hiện.
- **Nhường quyền nhóm trưởng**: mở Info Panel của nhóm → “Nhường quyền nhóm trưởng” → chọn thành viên → xác nhận. Nhóm sẽ có tin nhắn hệ thống 👑 thông báo.
- **Gọi thoại/video**: chỉ hỗ trợ trong chat riêng, bấm biểu tượng điện thoại/camera ở đầu cửa sổ chat.
- **Thông báo**: biểu tượng chuông giữ lại lịch sử, phân biệt “đã tương tác / chưa tương tác”.

---

## 6. Hệ thống Bot — công dụng & cách dùng

### 6.1. Bot dùng để làm gì?

Bot là một tài khoản đặc biệt (`profiles.is_bot = true`) do bạn sở hữu, có thể:

- Tự động trả lời tin nhắn trong chat/nhóm.
- Nhận sự kiện (tin nhắn mới, lệnh) và xử lý bằng máy chủ riêng của bạn qua webhook.
- Cung cấp kết quả tra cứu ngay trong ô soạn tin (Inline Bot).
- Mở giao diện web nhúng (Mini App) bên trong ứng dụng.

Ví dụ dùng thực tế: bot thông báo, bot tra cứu nội bộ, bot trực ban tự động, bot menu đặt món, bot ghi nhận công việc.

### 6.2. BotFather — tạo và cấu hình bot

Mở: **Cài đặt → 🤖 BotFather** (đây là một cuộc trò chuyện, bạn gõ lệnh như chat bình thường).

Các lệnh:

| Lệnh | Công dụng |
|---|---|
| `/start` | Bắt đầu, xem giới thiệu |
| `/help` | Hiện toàn bộ danh sách lệnh |
| `/newbot` | Tạo bot mới — BotFather hỏi tên hiển thị, rồi hỏi username (phải kết thúc bằng `bot`), sau đó trả về **token** |
| `/mybots` | Liệt kê các bot bạn đang sở hữu |
| `/deletebot` | Xoá một bot |
| `/setname` | Đổi tên hiển thị của bot |
| `/setdescription` | Đổi mô tả bot |
| `/setabouttext` | Đặt phần giới thiệu ngắn |
| `/setcommands` | Khai báo danh sách lệnh bot (mỗi dòng: `lenh - mô tả`) |
| `/setwebhook` | Đặt URL webhook để nhận sự kiện |
| `/setprivacy` | Bật/tắt chế độ riêng tư (bot chỉ đọc tin nhắn có lệnh hay đọc tất cả) |
| `/revoke` | Cấp lại token mới (token cũ mất hiệu lực ngay) |

**Quy trình tạo bot trong 5 bước**

1. Mở BotFather, gõ `/newbot`.
2. Nhập tên hiển thị, ví dụ `Trợ lý Kho`.
3. Nhập username, ví dụ `trolykho_bot`.
4. Lưu **token** mà BotFather trả về (giữ bí mật, ai có token là điều khiển được bot).
5. Gõ `/setcommands` để khai báo lệnh, rồi `/setwebhook` nếu bot cần xử lý bằng máy chủ riêng.

⚠️ Token không được đưa lên mã nguồn công khai. Nếu lộ, gõ `/revoke` ngay.

### 6.3. Bot Dashboard (`/bots`)

Giao diện quản lý trực quan cho bot của bạn: xem token, đổi mô tả, đặt webhook, bật/tắt bot, xem danh sách lệnh và nhật ký sự kiện.

### 6.4. Inline Bot

Gõ `@tên_bot ` kèm từ khoá ngay trong ô soạn tin, hệ thống hiển thị danh sách kết quả do bot trả về; chọn một kết quả để gửi thẳng vào cuộc trò chuyện. Bot trả kết quả bằng `answerInlineQuery`.

### 6.5. Mini App

Bot có thể mở một trang web nhúng trong cửa sổ ứng dụng (đặt hàng, khảo sát, biểu mẫu…). Cấu hình URL Mini App trong Bot Dashboard.

---

## 7. Bot API cho lập trình viên

Gọi Edge Function `bot-api`, kèm token bot. Các `action` hỗ trợ:

| Action | Công dụng |
|---|---|
| `sendMessage` | Gửi tin nhắn văn bản vào một cuộc trò chuyện |
| `sendFile` | Gửi file/ảnh |
| `editMessage` | Sửa tin nhắn bot đã gửi |
| `deleteMessage` | Xoá tin nhắn bot đã gửi |
| `getUpdates` | Lấy các sự kiện chưa xử lý (dạng polling) |
| `answerInlineQuery` | Trả kết quả cho truy vấn inline |
| `processInlineQuery` | Xử lý truy vấn inline phía máy chủ |

Ví dụ gửi tin nhắn:

```bash
curl -X POST "<BOT_API_URL>" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "sendMessage",
    "token": "<BOT_TOKEN>",
    "chat_id": "<CONVERSATION_ID>",
    "text": "Xin chào từ bot!"
  }'
```

Webhook: khi có sự kiện, hệ thống POST JSON tới URL bạn đặt bằng `/setwebhook`; máy chủ của bạn nên trả `200` nhanh rồi xử lý bất đồng bộ.

---

## 8. Câu hỏi thường gặp / Xử lý sự cố

- **Đăng ký xong không đăng nhập được**: tài khoản đang chờ admin duyệt tại `/admin-portal`.
- **Không thấy mục Admin**: tài khoản chưa có role `admin`; menu admin bị ẩn hoàn toàn với người dùng thường.
- **Gọi được nhưng không nghe thấy**: kiểm tra quyền micro của trình duyệt và thử lại; cuộc gọi chỉ hoạt động trong chat riêng.
- **Chấm xanh online sai**: trạng thái làm mới mỗi 20 giây, coi là offline nếu quá 45 giây không có tín hiệu.
- **Bot không phản hồi**: kiểm tra bot đang ở trạng thái `active`, webhook đúng URL và trả về mã 200, token chưa bị `/revoke`.
- **Không mở được cửa sổ chat từ hồ sơ**: bấm “Nhắn tin” trong hồ sơ sẽ tạo/mở chat riêng; nếu thất bại sẽ có thông báo lỗi hiện lên.
