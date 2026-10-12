# Studio Mockup In Áo

Web app tĩnh (không backend, không lưu server): đặt hình in lên **ảnh áo thật**,
tự động đánh giá chất lượng in (DPI), đề xuất chuyển vector / phóng nét,
xuất mockup PNG gửi khách và xuất file in (PNG 300dpi / SVG) + phiếu kỹ thuật
cho nhà in. Giao diện tiếng Việt.

## Cách mở

**Cách 1 — server local (khuyên dùng):**
```bash
cd /đường/dẫn/tới/repo
python3 -m http.server 8000
# mở http://localhost:8000
```

**Cách 2 — double-click `index.html`:** chạy được, app tự dùng config dự phòng
nhúng sẵn trong `js/app.js` (vì trình duyệt chặn `fetch` file JSON qua `file://`).

> Ảnh `Tshirt.jpg` / `Polo.jpg` nằm ở **root repo**, `index.html` tham chiếu
> bằng đường dẫn tương đối.

## Cấu trúc

```
index.html          trang chính
css/style.css       giao diện
js/app.js           toàn bộ logic (có comment tiếng Việt ở các hàm chính)
mockups/tshirt.json  config áo cổ tròn (ảnh Tshirt.jpg 4864x3242)
mockups/polo.json    config áo polo   (ảnh Polo.jpg  4000x3000)
```

## Thêm mockup mới (chỉ cần ảnh + JSON, không sửa code)

1. Chụp/Render ảnh áo: **mặt trước bên trái, mặt sau bên phải**, nền trơn,
   áo trắng hoặc sáng màu (để chế độ multiply hòa hình in vào vải).
2. Copy file JSON mẫu trong `mockups/`, đặt tên ví dụ `mockups/hoodie.json`.
3. Điền các trường:
   - `ten`, `fileAnh` (đường dẫn tương đối từ root, VD `"Hoodie.jpg"`),
     `kichThuocAnh` {w,h} đúng pixel ảnh.
   - `ao`: `kieu` (tên hiển thị), `size`, `ngangNgucCm` (số đo thật của áo),
     `daiAoCm`, `ngangNgucPx` (đo bằng pixel trên ảnh).
   - `positions[]`: mỗi vị trí in có `id`, `ten`, `center` {x,y} **tỉ lệ 0–1**
     so với ảnh, `khoInMacDinhCm`, `zone` {x0,y0,x1,y1} tỉ lệ 0–1 (vùng an toàn).
   - `warnZones[]`: `{"loai":"tron","ten":"...","x","y","r"}` hoặc
     `{"loai":"chunhat","ten":"...","x0","y0","x1","y1"}` — app cảnh báo đỏ
     khi hình in đè lên (cổ áo, nẹp nút, đường may...).
4. Thêm 1 dòng vào mảng `MOCKUPS` trong `js/app.js`:
   `{ id: 'hoodie', file: 'mockups/hoodie.json', ten: 'Áo hoodie trắng' }`.

**Cách đo tọa độ tỉ lệ:** mở ảnh trong trình duyệt, ước lượng vị trí theo tỉ lệ
0–1 (VD: điểm giữa ngực trước ≈ x 0.29, y 0.44). Có thể hiệu chỉnh dần trực
tiếp trên app bằng cách kéo hình in rồi đọc lại — tọa độ đúng khi hình in
nằm cân đối trên áo ở mọi vị trí.

## Hiệu chuẩn px/cm

Tỉ lệ `pxPerCm = ngangNgucPx / ngangNgucCm` quyết định hình in to/nhỏ thế nào
trên mockup. Trong app, panel “Thông số áo” có ô **Hiệu chuẩn ngang ngực (cm)**:
nếu in thử thấy lệch, nhập lại số đo thật — mọi kích thước in tính lại ngay.

## Quy tắc cứng: giữ đúng tỉ lệ ảnh gốc

Mọi xử lý (giữ nguyên / vector / phóng nét / khử nền / crop / đặt lên áo /
xuất file) đều giữ đúng tỉ lệ gốc của artwork. Hai ô rộng/cao (cm) tự đồng bộ
theo tỉ lệ, nút 🔒 luôn bật và hiển thị tỉ lệ đang khóa.

## Giới hạn đã biết

- **.ai / .eps:** app dùng PDF.js (CDN) thử đọc như PDF — chỉ thành công với
  file .ai được lưu mặc định **kèm nhân PDF**. File PostScript thuần không đọc
  được trực tiếp: app báo rõ bằng tiếng Việt, hãy mở bằng Illustrator rồi lưu
  lại dạng PDF/SVG rồi tải lên. (Cần mạng ở lần đầu để tải PDF.js.)
- **Phóng nét 2×/4×:** là **nội suy nâng độ phân giải trong trình duyệt**,
  không thêm chi tiết thật — chưa phải AI upscale. Không tích hợp Magnific hay
  API upscale nào trong bản này (xử lý sau).
- **Chuyển vector:** contour tracing thật (lượng tử màu → marching squares →
  nối đường bao → SVG path), hợp nhất với **hình phẳng ít màu** (logo, chữ,
  graphic). Ảnh chụp/phức tạp tracing sẽ xấu — app tự đề xuất phóng nét thay.
- Mockup hiện tại chỉ có áo trắng/sáng màu (dùng multiply để hòa hình in).
