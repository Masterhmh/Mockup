# Studio Mockup In Áo

Web app tĩnh (không backend, không lưu server): đặt hình in lên **ảnh áo thật**,
tự động đánh giá chất lượng in (DPI), đề xuất chuyển vector / phóng nét,
xuất mockup PNG gửi khách và xuất file in (PNG 300dpi / SVG) + phiếu kỹ thuật
cho nhà in. Mỗi vị trí in (ngực trước, logo ngực trái, lưng) giữ artwork
riêng — lưu/mở lại file làm việc theo tên khách + mã đơn (localStorage),
xuất hàng loạt file in khi khách chốt. Giao diện tiếng Việt.

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
     `maskFile` (VD `"mockups/hoodie-mask.png"` — ảnh RGBA tách áo khỏi nền,
     alpha = vùng áo; dùng để nhuộm màu áo. Không có thì app vẫn chạy nhưng
     không đổi được màu áo),
     `kichThuocAnh` {w,h} đúng pixel ảnh.
   - `ao`: `kieu` (tên hiển thị), `size`, `ngangNgucCm` (số đo thật của áo),
     `daiAoCm`, `ngangNgucPx` (đo bằng pixel trên ảnh).
   - `positions[]`: mỗi vị trí in có `id`, `ten`, `center` {x,y} **tỉ lệ 0–1**
     so với ảnh, `khoInMacDinhCm`, `zone` {x0,y0,x1,y1} tỉ lệ 0–1 (vùng an toàn),
     `exportZone` {x0,y0,x1,y1} tỉ lệ 0–1 (**khung vùng thân áo** dùng khi xuất
     file in theo vị trí — file xuất ra đúng bằng khung này ở 300dpi, hình in
     nằm đúng vị trí tương đối để nhà in in luôn không cần bình file lại).
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

## Luồng làm việc với khách hàng

1. Chọn mockup (áo cổ tròn / polo), chọn **vị trí in** (ngực trước, logo ngực
   trái, lưng). Mỗi vị trí giữ artwork + hình in **riêng** — chuyển dropdown
   vị trí là chuyển sang placement đang làm dở, không mất gì.
2. Tải file thiết kế lên (kéo-thả hoặc nút "Tải file thiết kế"). Nếu bật
   **"Tự động fit theo vị trí in"** (mặc định bật, trong panel "File thiết
   kế"), ảnh sẽ **tự thu vừa khít trong vùng in an toàn** (giữ đúng tỉ lệ gốc,
   căn giữa) rồi app mới tính DPI theo đúng khổ đã fit và đề xuất giữ nguyên /
   chuyển vector / phóng nét — bạn chốt tay sau khi so sánh trước/sau ở 100%.
   Tắt toggle thì app dùng cỡ mặc định `khoInMacDinhCm` như trước.
3. Kéo thả / nhập tay kích thước (cm) / crop / khử nền trắng. Bật **"Hiện số
   đo"** để xem: số đo áo (ngang ngực, dài áo), số đo hình in, **vùng an
   toàn** (nét đứt xanh lá), **phạm vi vùng in** (nét liền xám). Chú thích màu
   các đường kẻ nằm ngay dưới toolbar. Khi kéo hình in, cảnh báo **tràn vùng
   an toàn / đè lên vùng cấm** (cổ, nẹp, đường may) hiện **ngay trong lúc kéo**,
   không chờ thả tay. Bấm nút tròn đỏ **×** ở góc trên-phải khung chọn để xóa
   hình in nhanh (ngoài nút "Xóa hình in" trên panel).
4. **Xuất mockup PNG** gửi khách duyệt.
5. Khách chốt từng vị trí thì **lưu file làm việc** (panel "File làm việc",
   tên file = tên khách + mã đơn, lưu trong trình duyệt). Làm nhiều đơn thì
   mỗi đơn một file, mở lại bất cứ lúc nào. Lựa chọn màu file in (giữ nguyên /
   1 màu) cũng được lưu theo.
6. Khi khách chốt hết: mở lại file → **"Xuất hàng loạt file in"** — mỗi vị trí
   in ra một file PNG 300dpi đúng bằng khung vùng thân áo (`exportZone`),
   hình in nằm đúng vị trí tương đối, nền trong suốt. Tên file:
   `in-<tenkhach>-<madon>-<tenvitri>-<w>x<h>cm-300dpi.png`.
   Nếu đã vector hóa thì có thêm "Xuất file in theo vị trí (SVG)".

## Màu file in (panel "Xuất file")

- **Giữ nguyên màu gốc** (mặc định): dùng cho in ảnh — mọi đầu ra giữ màu thật.
- **In 1 màu** (dùng cho in logo): chọn màu bằng ô màu hoặc swatch có sẵn
  (đen, trắng, đỏ, xanh navy, vàng, xanh lá). Khi bật, **mọi chỗ dùng design
  đều đổi màu**: mockup preview, mockup PNG, file in PNG (thường + theo vị trí),
  file in SVG (thường + theo vị trí), xuất hàng loạt.
- Raster: ép 1 màu bằng `source-in` (giữ nguyên độ trong suốt alpha gốc).
  SVG: thay mọi `fill="..."` thành màu đã chọn, giữ `fill-rule="evenodd"`.
- Tùy chọn màu được lưu vào file làm việc và in ra phiếu kỹ thuật.

## Màu áo (ngay dưới toolbar)

- Hàng swatch tròn ngay dưới dropdown chọn Mockup: Trắng (mặc định), Đen,
  Navy, Đỏ đô, Xanh dương, Xanh rêu, Xám, Hồng, Vàng, Cam. Bấm là đổi màu áo
  ngay trên mockup (kèm tên màu).
- Cách nhuộm: ảnh áo gốc `multiply` với màu đã chọn, rồi cắt đúng vùng áo
  bằng **mask** (`destination-in`) — nền xung quanh không bị lem. Nếp vải và
  bóng đổ được giữ nguyên vì multiply giữ lại độ sáng tương đối của vải.
- Nền đã nhuộm được **cache theo (mẫu áo + màu)** nên đổi qua lại không phải
  tính lại. Màu trắng = dùng thẳng ảnh gốc, không tính toán gì thêm.
- **Hình in trên áo tối** (độ sáng màu áo < 0.45, VD đen/navy): app tự chuyển
  sang vẽ đè trực tiếp (`source-over`, alpha 0.96) thay vì multiply — vì
  multiply trên nền tối làm hình in mất hút. Áo sáng vẫn dùng multiply để
  hình hòa vào chất vải.
- Màu áo được **lưu vào file làm việc** (mở lại là giữ nguyên) và in ra
  **phiếu kỹ thuật** gửi nhà in.

## Hiệu chuẩn exportZone

`exportZone` quyết định khung file in gửi nhà in. Kích thước cm của khung suy
từ `pxPerCm` (đã hiệu chuẩn ở panel "Thông số áo"), nên sau khi hiệu chuẩn
ngang ngực đúng, khung in sẽ đúng kích thước thật. Nếu đổi ảnh mockup, đo lại
`exportZone` theo tỉ lệ 0–1 bao quanh vùng thân áo cần in.

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
