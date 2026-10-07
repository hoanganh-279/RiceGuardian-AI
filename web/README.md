# RiceGuardian AI — Website quản trị

Đọc file này **trước** khi thêm hoặc sửa bất kỳ chức năng nào trên Website.

RiceGuardian AI là nền tảng AI dự báo sớm bệnh hại và quản lý canh tác lúa thông minh. Website này là giao diện quản trị cho Admin, Quản lý doanh nghiệp/HTX và Kỹ thuật viên nông nghiệp — **không** phải App nông dân.

Workspace hiện tại: `web/` — frontend React (Vite) + Bootstrap 5. Mặc định **UI-only mock**; bật live bằng `VITE_LIVE_API=1` + Flask [`backend/`](../backend/) (port **5001**). Website giới thiệu + `site/backend` vẫn trong monorepo.

---

## 1. Giới thiệu

| Thành phần | Vai trò | Thư mục |
|---|---|---|
| Website quản trị | Dashboard, quản lý đơn vị/thửa ruộng, cảnh báo, báo cáo | `web/` (frontend) |
| App nông dân | Ghi nhật ký, gửi ảnh, nhận cảnh báo (codebase riêng) | `app/` (frontend) |
| Web admin API | Flask profile=`web` | `backend/` local (port **5001**) hoặc repo bàn giao |
| Farmer API | Flask profile=`app` | Repo backend riêng (port **5000**) |
| Site API | Flask profile=`site` | `site/backend/` |
| Shared lib (monorepo) | `import core` — site + local staff entry | `packages/rg_core/` |
| Database | PostgreSQL trên Supabase — nguồn dữ liệu gốc | — |

Workspace hiện tại: `web/` — frontend React (Vite) + Bootstrap 5. Vite proxy `/api` + `/uploads` → `:5001`. Demo mock khi không set `VITE_LIVE_API=1` (mật khẩu demo: `123456@`) — xem `src/data/mockUsers.js`.

---

## 2. Kiến trúc tổng quan

```
Web (React + Vite) ──VITE_LIVE_API=1──► backend/ :5001 (profile=web) ──► packages/rg_core
                   ──(mặc định)──────► mock in-memory (UI-only; metrics = "-")
App (Flutter)      ──demo offline──► LocalStore (UI-only; metrics = "-")
Site (marketing)   ──REST──────► site/backend :5002
                                      │
                                      └── packages/rg_core ──► Supabase PostgreSQL / SQLite local
```

Ràng buộc không được tự ý đổi:

- Web và App **không** dùng chung logic UI.
- **Không** tái tạo `app/backend` / `web/backend`. Entry staff local trong monorepo: `backend/` (mỏng, dùng `rg_core`) — không phục hồi cây `backend/core/`.
- Chế độ UI-only: không `fetch` staff API; số liệu hệ thống hiển thị `-`.
- Site marketing + `site/backend` giữ nguyên trong monorepo.

---

## 3. Ba vai trò và phạm vi dữ liệu

Mọi chức năng mới phải nêu rõ: **dành cho vai trò nào** và **hiển thị dữ liệu theo phạm vi nào**.

| Vai trò | Phạm vi dữ liệu |
|---|---|
| Admin | Toàn hệ thống: tài khoản, đơn vị, IoT, cấu hình AI, audit log, **và canh tác** (cảnh báo, bản đồ, cảm biến, ảnh, UAV, nhật ký, trạm, lịch). Landing sau đăng nhập là **B0 Dashboard hệ thống** (`/admin`) — biểu đồ UAV/IoT theo vùng. |
| Quản lý doanh nghiệp/HTX | Toàn đơn vị của mình |
| Kỹ thuật viên nông nghiệp | Mặc định gộp **tất cả** đơn vị được Admin phân công; mỗi mục gắn nhãn tên đơn vị |

**Kỹ thuật viên có thể phụ trách nhiều đơn vị cùng lúc.** Danh sách/dashboard của vai trò này:

- Mặc định gộp dữ liệu từ mọi `org_id` trong `user_organization`.
- Không bắt buộc chọn 1 đơn vị trước khi xem.
- Lọc theo 1 đơn vị (mục A2 — Đơn vị của tôi) chỉ là thao tác tùy chọn trên thanh điều hướng.
- API liên quan nhận **danh sách `org_id`**, không nhận 1 `org_id` cố định.

---

## 4. Mô hình dữ liệu cốt lõi

Không tự đổi cấu trúc quan hệ nếu không được yêu cầu.

```
Doanh nghiệp / HTX
  └── Vùng trồng
        └── Thửa ruộng ──► Trạm IoT (cảm biến time-series, nhiều bản ghi theo thời gian)
              ├── nhiều hộ nông dân (1 thửa có thể liên kết nhiều hộ)
              └── Mùa vụ
                    └── Nhật ký canh tác
                          └── Cảnh báo bệnh hại
```

Cảm biến IoT là **time-series** — không thiết kế như dữ liệu tĩnh 1-1 với trạm.

Nếu chức năng động chạm schema: nêu rõ thay đổi bảng (Supabase) **trước khi code**.

---

## 5. Ba nguồn dữ liệu đầu vào

Mỗi chức năng liên quan đến dữ liệu cần nêu rõ dùng nguồn nào:

1. **Cảm biến IoT** — vi khí hậu (nhiệt độ, độ ẩm, mực nước…), tự động, liên tục.
2. **Ảnh từ App nông dân** — thủ công, theo sự kiện (nông dân chụp khi thấy bất thường).
3. **Ảnh UAV** — theo đợt khảo sát diện rộng, dữ liệu lớn; xử lý bất đồng bộ (Celery), không load trực tiếp trên request.

---

## 6. Nguyên tắc cảnh báo bệnh hại

Hệ thống hướng đến **dự báo sớm nguy cơ** (tổ hợp môi trường + hình ảnh), không chỉ nhận diện khi đã có triệu chứng rõ.

UI và logic phải phân biệt 2 loại:

| Loại | Ý nghĩa |
|---|---|
| Cảnh báo nguy cơ | Dự báo — điều kiện môi trường bất thường, chưa chắc đã có bệnh |
| Kết quả nhận diện từ ảnh | Đã có biểu hiện — AI nhận diện trên ảnh App hoặc UAV |

Phản hồi cảnh báo (D4: Chính xác / Sai / Cần theo dõi thêm) đưa vào hàng chờ huấn luyện AI (B6). Bắt buộc nhập lý do khi chọn "Sai".

---

## 7. Stack và ràng buộc kỹ thuật

### Frontend (`web/`)

- React + Vite + Bootstrap 5.
- Gọi API qua `web/src/services/api.js`.
- Code splitting theo route: `React.lazy` + `Suspense`.
- Danh sách dài (cảm biến, nhật ký, log): virtualization (`react-window`).
- Debounce ô tìm kiếm — không gọi API mỗi ký tự.
- Ảnh: lazy load, WebP, kích thước responsive.
- Cache kết quả API lặp lại trong phiên làm việc.

### Staff / farmer API

- Staff API local monorepo: [`backend/`](../backend/) (`profile=web`, port **5001**) — BLB UAV weights đa phổ 6 kênh tại `web/blb_uav_seg_ms_d2/` (~619 MB, không commit; xem `backend/README.md`).
- Farmer Socket.IO: repo backend bàn giao (`profile=app`, port **5000**).
- Shared lib: `packages/rg_core`; không viết logic staff API mới trong `web/src` ngoài client `api.js`.
- Khi không bật live (`VITE_LIVE_API` trống và không có `VITE_API_URL`): UI dùng mock trong `api.js` / `src/data/`.

### Thương hiệu UI

```css
--rg-primary: #2E7D32;   /* xanh lúa */
--rg-secondary: #F9A825;
--rg-danger: #C62828;
```

Không đổi bảng màu trừ khi được yêu cầu.

### Quy chuẩn UX khi thêm/sửa dữ liệu

Mọi thao tác chỉnh sửa phải thuộc đúng **một** cấp. Nếu mô tả chức năng chưa nói rõ cấp độ, đề xuất cấp phù hợp — không mặc định luôn dùng trang riêng.

| Cấp | Hình thức | Khi nào dùng | Ví dụ |
|---|---|---|---|
| Nhỏ (Inline) | Sửa tại chỗ, không chuyển trang, không modal | 1 giá trị đơn lẻ, không logic phụ thuộc | Đổi tên thửa, bật/tắt trạng thái, đánh dấu đã xem |
| Trung bình (Modal) | Hộp thoại trên trang hiện tại | Nhiều trường, vẫn trong ngữ cảnh đang xem, cần xác nhận | Xác nhận cảnh báo (D4), đổi mật khẩu, thêm nhật ký |
| Lớn (Dedicated page) | Trang riêng, URL riêng | Form nhiều bước, bản đồ, upload, luồng độc lập | Tạo vùng trồng (vẽ ranh giới), cấu hình ngưỡng AI, báo cáo C5 |

---

## 8. Bản đồ chức năng Website

### A. Xác thực và không gian làm việc — cả 3 vai trò

| Mã | Chức năng | Vai trò | Cấp độ | Ghi chú |
|---|---|---|---|---|
| A1 | Đăng nhập | Cả 3 | Dedicated page | Email/SĐT + mật khẩu → JWT + vai trò. Khóa 15 phút sau 5 lần sai. KTV và Admin vào thẳng D1 (KTV không bắt buộc A2). |
| A2 | Đơn vị của tôi | KTV (khi >1 đơn vị) | Xem dạng thẻ; lọc Inline trên nav | **Không còn cổng bắt buộc.** Click thẻ = lọc 1 đơn vị; nút "Xem tất cả đơn vị" quay lại tổng hợp. |
| A3 | Hồ sơ / đổi mật khẩu | Cả 3 | Inline (hồ sơ) / Modal (mật khẩu) | Đổi mật khẩu yêu cầu mật khẩu cũ. |
| A4 | Đăng xuất | Cả 3 | — | Xóa token client, vô hiệu hóa phiên server. |

### B. Admin

Sidebar Admin gồm 3 nhóm: **Hệ thống**, **Tài khoản khách hàng**, **Chung**. Landing sau đăng nhập = **B0 Dashboard** tại `/admin` (biểu đồ UAV / IoT theo vùng). **Quản lý tài khoản** (B1_STAFF, `/admin/staff`) nằm trong Hệ thống; **Quản lý tài khoản khách hàng** (B1, `/admin/users`) chỉ nông dân. Các trang B2 / B4 / B5 / B6 / B8 không còn trên sidebar nhưng vẫn mở được từ **Cài đặt chung → Quản trị nâng cao**.

| Mã | Chức năng | Cấp độ | Ghi chú |
|---|---|---|---|
| B0 | Dashboard hệ thống | Chỉ xem | `/admin` — biểu đồ đợt UAV và trạm IoT theo vùng; chỉ số cảnh báo bệnh đang mở. |
| B1 | Quản lý tài khoản khách hàng | Page (danh sách) + Modal (tạo/khóa/reset) | `/admin/users` — **chỉ nông dân** (App). Khóa/xóa ghi audit log. |
| B1_STAFF | Quản lý tài khoản (nhân sự) | Page + Modal | `/admin/staff` — nhóm **Hệ thống**. Admin / Quản lý / KTV. Không lẫn nông dân. |
| B2 | Quản lý đơn vị (HTX/DN) | Page + Inline (khóa/mở) + Modal (tạo/sửa) | Không còn trên sidebar; vào từ Cài đặt. |
| B3 | Quản lý thiết bị IoT toàn hệ thống | Page + Modal (gán/thu hồi) | `/admin/devices`. Canh tác: thêm/sửa trạm từ chi tiết thửa (D2). |
| B4 | Cấu hình ngưỡng cảnh báo & tham số AI | Dedicated page | Không còn trên sidebar; vào từ Cài đặt. |
| B5 | Giám sát tình trạng hệ thống | Chỉ xem | `/admin/system` — không phải trang chủ; vào từ Cài đặt. |
| B6 | Dữ liệu huấn luyện AI | Dedicated page | Không còn trên sidebar; vào từ Cài đặt. |
| B7 | Nhật ký hoạt động (audit log) | Chỉ xem | Nhóm Tài khoản khách hàng. Elasticsearch khi log lớn. |
| B8 | Phân công KTV cho đơn vị | Modal (gán) + Inline (gỡ) | Không còn trên sidebar; vào từ Cài đặt. |
| B9 | Phương án giải quyết bệnh cây lúa | Chỉ xem (stub) | `/admin/disease-plans` — catalog 9 lớp; **import Excel bổ sung sau**. |
| B10 | Cảnh báo vận hành (Admin) | Page master-detail | `/admin/alerts` — nguy cơ IoT + sự cố trạm + hệ thống. **Khác** Cảnh báo bệnh (D3 ảnh nông dân). |
| B11 | Bản tin nông dân | Page list + Dedicated editor | `/admin/articles` (Admin) và `/technician/articles` (KTV). KTV soạn → `pending_review`; Admin duyệt/xuất bản. Ảnh bìa qua Storage. |
| B12 | Hỏi đáp bản tin | Master-detail | `/admin/article-questions` / `/technician/article-questions`. Trả lời + FAQ công khai + thông báo App `article_reply`. **Khác** D4. |

Menu **Hệ thống** trên sidebar còn dùng các trang canh tác: Quản lý vùng (D2), Dữ liệu UAV (D7), Nhật ký vùng (D8), Lịch kiểm tra (D10). Menu **Tài khoản khách hàng**: Cảnh báo bệnh (`/technician/alerts?type=image`), Dữ liệu từ khách hàng (D6), **Bản tin nông dân (B11)**, **Hỏi đáp bản tin (B12)**.

### C. Quản lý doanh nghiệp / HTX

| Mã | Chức năng | Cấp độ | Ghi chú |
|---|---|---|---|
| C1 | Dashboard tổng quan đơn vị | Chỉ xem | Diện tích, thửa có cảnh báo, KTV, xu hướng. |
| C2 | Danh sách KTV phụ trách | Danh sách + Modal (phân công vùng) | Không tự thêm/xóa KTV — liên hệ Admin. |
| C3 | Quản lý vùng trồng / thửa ruộng | Page (tạo/vẽ bản đồ) + Inline (tên/diện tích/giống) | GPS/ranh giới, hộ nông dân liên kết. |
| C4 | Báo cáo tổng hợp mùa vụ | Chỉ xem, lọc Inline | Elasticsearch aggregate. |
| C5 | Xuất báo cáo truy xuất nguồn gốc | Dedicated page | Thửa + mùa vụ → PDF/Excel. |
| C6 | Quản lý hộ nông dân | Page + Modal (thêm) + Inline (liên hệ) | Cấp tài khoản App. |

### D. Canh tác (Kỹ thuật viên + Admin)

KTV: mặc định gộp mọi đơn vị phụ trách, gắn nhãn tên đơn vị; lọc 1 đơn vị qua A2. Admin: dùng chung các trang `/technician/*` (dữ liệu **toàn hệ thống**, không A2); landing Admin là B0 `/admin`, không phải D1.

| Mã | Chức năng | Vai trò | Cấp độ | Ghi chú |
|---|---|---|---|---|
| D1 | Dashboard vùng trồng | KTV (+ Admin qua URL) | Chỉ xem | Landing KTV. Admin landing = B0. |
| D2 | Bản đồ / quản lý vùng | KTV + Admin; Quản lý HTX xem `/manager/map` | Lưới ô + trang chi tiết thửa | Admin menu: **Quản lý vùng**. Mỗi ô = một thửa. |
| D3 | Cảnh báo bệnh hại | KTV + Admin | Chỉ xem, lọc Inline | Admin menu **Cảnh báo bệnh** mặc định `type=image` (ảnh nông dân báo bệnh). KTV xem đủ loại. |
| D4 | Xác nhận / phản hồi cảnh báo | KTV + Admin | Modal | Chính xác / Sai / Cần theo dõi + ảnh. Lý do bắt buộc khi "Sai". |
| D5 | Chi tiết cảm biến IoT theo trạm | KTV | Chỉ xem, lọc Inline | Time-series; so sánh ngưỡng. Admin xem qua B3 tab Cảm biến (không còn mục menu D5). |
| D6 | Ảnh nông dân + kết quả nhận diện | KTV + Admin | Chỉ xem + Modal | Admin menu: **Dữ liệu từ khách hàng**. |
| D7 | Dữ liệu UAV theo đợt khảo sát | KTV + Admin | Dedicated page | Admin menu: **Dữ liệu từ UAV**. Xử lý async (Celery). |
| D8 | Nhật ký đồng ruộng / quản lý vùng | KTV + Admin | Modal | Admin menu: **Nhật ký quản lý vùng**. |
| D9 | Trạm IoT tại thửa | KTV + Admin | Từ chi tiết thửa + trang sự cố | Không còn menu riêng. 1 trạm / 1 thửa. `/technician/stations` redirect về D2. Chi tiết trạm: `/technician/stations/:id`. |
| D10 | Lịch kiểm tra thực địa | KTV + Admin | Modal (tạo) + Inline (hoàn thành) | Admin menu: **Lịch kiểm tra**. Liên kết D4. |

### E. Dùng chung (Web)

| Mã | Chức năng | Vai trò | Cấp độ | Ghi chú |
|---|---|---|---|---|
| E1 | Trung tâm thông báo | Cả 3 | Modal + Inline (đã đọc) | KTV: 1 danh sách gộp, gắn nhãn đơn vị. WebSocket. |
| E2 | Tìm kiếm / lọc toàn hệ thống | KTV + Manager (Admin qua Cài đặt) | Inline | Không còn trên sidebar Admin. Elasticsearch, debounce. |
| E3 | Cài đặt chung | Cả 3 (một số mục chỉ Admin) | Inline | Ngôn ngữ, thông báo, múi giờ. Admin: thêm block Quản trị nâng cao. |
| B10 | Cảnh báo (Admin) | Admin | Page | Trong nhóm Chung của sidebar Admin — xem mục B. |

---

## 9. Quy trình khi code chức năng mới

1. Đọc README này trước.
2. Xác định: vai trò nào dùng, phạm vi dữ liệu (toàn hệ thống / đơn vị / vùng phụ trách), nguồn dữ liệu (IoT / ảnh App / UAV).
3. Nếu chưa rõ vai trò → **hỏi lại**, không tự giả định.
4. Nếu đụng mô hình dữ liệu → nêu thay đổi schema/bảng Supabase trước khi code.
5. Nếu chưa nói cấp độ UX → đề xuất Inline / Modal / Dedicated page theo bảng mục 7.
6. Code đúng cấu trúc (`web/` frontend). Không đổi stack/kiến trúc. Không tái tạo `web/backend` / cây `backend/core/`.
7. KTV: API nhận danh sách `org_id`; UI mặc định tổng hợp, lọc đơn vị là tùy chọn.
8. API danh sách phải phân trang. Tìm kiếm phải debounce. Route mới phải lazy-load.

Công cụ phát triển: VSCode. Dán prompt ngữ cảnh dự án vào đầu mỗi lần yêu cầu code chức năng mới, kèm mô tả chức năng.

---

## 10. Trạng thái repo

| Hạng mục | Trạng thái |
|---|---|
| `web/README.md` | Có — file này |
| Scaffold React + Vite + Bootstrap 5 | Có — auth shell gọi Flask API khi có staff API |
| Staff / farmer API | `backend/` (staff local) + repo bàn giao (farmer) |
| `packages/rg_core` (monorepo) | Có — `site/backend` + `backend/` |
| MVP KTV D1 / D3 / D4 / E1 | Có — mock mặc định; live auth/fields/BLB khi `VITE_LIVE_API=1` |
| Phase 4 khung A–E | Có — mọi trang có file riêng + mock API (E2/E3, D2/D5–D10, C1–C6, B1–B8) |
| Docker Compose, Nginx, Gunicorn | Chưa — scaffold khi triển khai thử nghiệm thực địa |

### Chạy Website (UI-only mock)

```bash
cd web
npm install
npm run dev
```

Mở `http://localhost:5173`. Auth demo local (không gọi Flask). Số liệu KPI / sensor / diện tích / badge = `-`.

### Chạy Website + BLB live (local)

```bash
# Terminal 1 — staff API
cd E:\riceguardian-ai\backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
python run.py

# Terminal 2 — Vite
cd E:\riceguardian-ai\web
# Tạo .env.local với: VITE_LIVE_API=1
npm install
npm run dev
```

Login KTV `ktv@gmail.vn` / `123456@` → Quản lý vùng / chi tiết thửa → **Liên kết ảnh UAV đa phổ (TIFF 6 kênh)** → cắt ảnh (tùy chọn, cắt trực tiếp TIFF) → vẽ ranh giới → phân tích BLB trong ranh giới.

- Chỉ TIFF đúng 6 kênh được phân tích; JPG/PNG chỉ lưu làm ảnh bìa (hiện cảnh báo).
- Thứ tự kênh chưa được xác minh — người tải lên chịu trách nhiệm đúng thứ tự như lúc train. Màu ảnh xem trước (`BLB_MS_PREVIEW_BANDS`) chỉ để hiển thị.
- Chạy CPU với TIFF lớn sẽ chậm.

| Vai trò | Email / SĐT | Mật khẩu demo |
|---|---|---|
| Admin | `admin@riceguardian.vn` / `0901000001` | `123456@` |
| Quản lý doanh nghiệp/HTX | `manager@gmail.vn` / `0901000002` | `123456@` |
| Kỹ thuật viên nông nghiệp (2 đơn vị) | `ktv@gmail.vn` / `0901000003` | `123456@` |

KTV đăng nhập xong vào thẳng dashboard D1. Admin vào **B0** `/admin`. List thửa/cảnh báo giữ tên khung; ô số liệu hiển thị `-`.

```
web/
  README.md
  src/
    services/api.js
    utils/metricDisplay.js
    constants/roles.js
    pages/
    components/
    context/
    data/
    styles/
```
