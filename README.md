# Xưởng In Mẫu

Web app tĩnh (không backend, không lưu server): đặt hình in lên **ảnh áo thật**,
tự động đánh giá chất lượng in (DPI), đề xuất chuyển vector / phóng nét,
xuất mockup PNG gửi khách và xuất file in (PNG 300dpi / SVG) + phiếu kỹ thuật
cho nhà in. Giao diện **Layers kiểu Photoshop**: mỗi file thiết kế tải lên
là 1 layer — bấm trực tiếp vào hình trên canvas để chọn, kéo di chuyển tự do,
kéo góc thu/phóng (luôn khóa tỉ lệ). Phím tắt (sau khi **click vào canvas**):
**Ctrl+C** copy, **Ctrl+V** paste, **Del** xóa layer đang chọn.
Chọn nhiều layer: giữ **Ctrl** (hoặc **Shift**) + click vào từng hình; kéo để di chuyển
cả tập; nút **căn chỉnh** trong panel Layers (trái/phải/trên/dưới/giữa + giãn đều);
kéo 1 layer có **đường gióng thông minh** (hút vào cạnh/giữa các layer khác).
Panel Layers quản lý ẩn/hiện, thứ tự, xóa từng layer. Lưu/mở lại file làm việc dạng file **.cm** (tải về máy, tên theo mã đơn).
Nút **Lưu/Mở file (.cm)** nằm cùng hàng toolbar với nút **Tải file**. Mục **Nâng cao**
(Thông số áo, Hiệu chuẩn ngang ngực, Màu file in) nằm trong panel **Chất lượng
& Xử lý**, luôn hiển thị. 5 nút **preset vị trí in** (Ngực trái / Ngực phải / Giữa mặt trước /
Lưng trên / Lưng giữa) trong panel Layer đang chọn: bấm là tự căn đúng vị trí +
cỡ chuẩn từ config, không hiện cảnh báo vùng an toàn (cảnh báo chỉ khi chỉnh tay).
Giao diện tiếng Việt. **Chế độ sáng/tối**: nút toggle trên toolbar (góc phải),
lưu lựa chọn vào trình duyệt, icon flat tự đổi theo theme. Tất cả icon dạng
**flat hiện đại** (SVG đơn sắc, không 3D).

## Cách mở

**Cách 1 — server local (khuyên dùng):**
```bash
cd /đường/dẫn/tới/repo
python3 -m http.server 8000
# mở http://localhost:8000
```

**Cách 2 — double-click `index.html`:** chạy được, app tự dùng config dự phòng
nhúng sẵn trong `js/app.js` (vì trình duyệt chặn `fetch` file JSON qua `file://`).

> Ảnh `Tshirt.png` / `Polo.png` (PNG **nền trong suốt**, áo đã tách nền sẵn)
> nằm ở **root repo**, `index.html` tham chiếu bằng đường dẫn tương đối.

## Cấu trúc

```
index.html          trang chính
css/style.css       giao diện
js/app.js           toàn bộ logic (có comment tiếng Việt ở các hàm chính)
mockups/tshirt.json  config áo cổ tròn (ảnh Tshirt.png 4052x2283, nền trong suốt)
mockups/polo.json    config áo polo   (ảnh Polo.png  3469x1933, nền trong suốt)
```

## Thay logo

Logo hiện tại (nền xanh, chữ XIM) đang được nhúng trực tiếp trong `index.html`
dưới dạng base64 (`<img class="brand-logo" src="data:image/png;base64,...">`),
vì công cụ GitHub không upload được file nhị phân (PNG/JPG) đúng cách.

Muốn đổi logo: gửi ảnh PNG mới cho mình, hoặc tự thay chuỗi base64 sau
`data:image/png;base64,` trong thẻ `<img class="brand-logo">` bằng ảnh PNG
mới (khuyên dùng ảnh vuông 512x512, nền đơn sắc).

## Layers (kiểu Photoshop)

- Tải file **hàng loạt**: chọn nhiều file cùng lúc (hoặc kéo-thả nhiều file vào canvas), mỗi file tạo 1 layer mới,
  đặt ở giữa ngực trước với cỡ in mặc định.
- **Thao tác trực tiếp trên canvas**: bấm vào hình để chọn layer, kéo để di chuyển
  tự do (không giới hạn vị trí), kéo 4 tay cầm góc để thu/phóng (luôn giữ đúng
  tỉ lệ gốc), bấm nút × đỏ để xóa.
- **Panel Layers** (sidebar): thumbnail + tên file, bấm để chọn, nút 👁 ẩn/hiện,
  ↑↓ đổi thứ tự chồng lớp, ✎ đổi tên, × xóa. Badge "⧉ Nhóm" cho layer thuộc group.
  Đổi tên: bấm nút bút chì (hoặc nhấp đúp vào tên) → gõ tên ngay tại chỗ,
  Enter/bấm ra ngoài để lưu, Escape để hủy; tên rỗng giữ nguyên; có ghi bước hoàn tác.
- **Group/Ungroup**: chọn ≥2 layer rồi `Ctrl+G` để group (kéo/xóa 1 layer sẽ áp dụng
  cả group), `Ctrl+Shift+G` để bỏ group.
- **Căn chỉnh kiểu Photoshop**: thanh "Căn chỉnh / Giãn đều" với 12 icon SVG theo đúng
  mẫu Photoshop (đường trục + chữ nhật), giữ Ctrl/Shift + click để chọn nhiều layer,
  kéo có đường gióng magenta + hút, **giữ Shift khi kéo** để di chuyển thẳng ngang/dọc.
- Mọi nút xử lý ảnh (vector, phóng nét, khử nền, crop), đánh giá DPI, ô kích thước
  cm đều áp dụng cho **layer đang chọn**.
- **Mã đơn tự sinh**: `CM_POD_` + 7 chữ số (hiện ở ô readonly khi lưu/xuất).
  Tên file ZIP = `{Tên KH}-{Mã đơn}.zip` (trống tên KH thì chỉ `{Mã đơn}.zip`).
- Xuất file: "Xuất mockup" vẽ tất cả layer hiện; "Xuất file in (ZIP)" tải gói ZIP gồm
  **mockup.png** + từng file in **300dpi** nền trong suốt đúng khổ cm (tên theo layer)
  + **thong-tin.txt** (tên KH, mã đơn, vị trí mặt trước/lưng, kích thước từng hình)
  + **file dự án .cm** (đúng định dạng nút "Lưu file (.cm)" — mở lại bằng "Mở file (.cm)" để chỉnh sửa tiếp);
  "Xuất file in SVG (ZIP)" tải gói ZIP gồm **mockup.png** + từng file **SVG** đúng khổ cm
  + **thong-tin.txt**. Khi xuất ZIP hiện **chỉ báo tiến trình ở lại màn hình**:
  "Đang tạo file in i/N…" từng file, rồi "Đang nén ZIP… x%" (theo callback của JSZip);
  xong mới ẩn + hiện toast thành công; lỗi giữa chừng ẩn chỉ báo + toast lỗi rõ ràng.
- Cảnh báo trùng màu: hình có độ sáng gần giống màu áo (chênh < 0.3, cả sáng-trên-sáng
  và tối-trên-tối) hiện trong thanh cảnh báo + toast khi thêm/đổi màu áo.

## Hoàn tác / Làm lại (Undo/Redo)

- **Ctrl+Z** hoàn tác, **Ctrl+Shift+Z** / **Ctrl+Y** làm lại — hoạt động **toàn trang**,
  không cần click vào canvas trước. Khi đang gõ chữ trong ô nhập liệu (tên khách,
  đơn giá...) thì trình duyệt xử lý mặc định (chỉ hoàn tác văn bản trong ô).
- Cụm 3 nút **overlay tách rời ở góc trên-trái trong khung canvas** (không bị zoom ảnh hưởng):
  Hoàn tác, Làm lại, và **Khóa/Mở khung canvas** — mỗi nút là ô riêng có nền/viền/bóng
  riêng theo theme, icon tương phản cao ở cả 2 chế độ sáng/tối; nút tự mờ khi không có
  gì để undo/redo; trong lúc đang khôi phục thì tạm khóa để chống bấm dồn.
  Di chuột vào mỗi nút hiện tooltip (nền đen chữ trắng); trên cảm ứng tooltip không hiện.
- **Khóa khung canvas**: khi BẬT thì chặn zoom (cuộn chuột/chụm ngón/nút zoom) và kéo-pan
  vùng nhìn — tránh lỡ tay làm lệch khung khi đang căn chỉnh; kéo/sửa layer vẫn bình thường.
  Nút chỉ hiện 1 icon theo trạng thái (mở/đóng), khi BẬT có style đảo màu nền/chữ rõ ràng.
  **Mặc định BẬT mỗi khi mở app** (không lưu lựa chọn qua các lần mở); người dùng bấm để
  tắt/bật. Fit khung lúc khởi động là thao tác nội bộ, không bị khóa chặn.
- Chụp snapshot toàn workspace (layers + vị trí/kích thước/group/ẩn-hiện + màu áo + kiểu áo + tùy chọn màu in)
  **trước** mỗi thao tác: thêm/xóa/dán layer, kéo thả xong, thu/phóng xong, group/ungroup,
  căn chỉnh, preset vị trí, đổi cỡ ô nhập, đổi màu áo/kiểu áo, ẩn/hiện/đổi thứ tự layer,
  xử lý ảnh (vector/phóng nét/khử nền trắng/crop). Mỗi lần bấm hoàn tác lùi đúng **1 bước thật**:
  snapshot trùng trạng thái hiện tại (bước rỗng) tự bị bỏ qua.
- Snapshot giữ **tham chiếu canvas trong bộ nhớ** (không chụp qua `toDataURL()`) nên khôi phục
  tức thì và không mất layer kể cả với artwork rất lớn trên iPhone (nơi `toDataURL()` có thể lỗi
  vì giới hạn bộ nhớ canvas — lỗi cũ khiến hoàn tác 1 lần mất hết hình).
- Kéo layer ghi bước qua `beginDragSnap/commitDragSnap`; handler kết thúc pinch (capture) chỉ
  dọn drag khi vừa pinch thật — không được xóa drag của lần kéo thường, nếu không kéo xong
  sẽ không có bước hoàn tác và lần Ctrl+Z kế tiếp nhảy thẳng về trạng thái cũ nhất.
  Ảnh layer sau khôi phục được chuyển thành canvas nên snapshot tiếp theo vẫn đầy đủ dữ liệu
  (không bị mất ảnh khi undo lần 2-3 như bản cũ).
- Kéo thả chỉ ghi 1 bước undo khi thả ra (không ghi liên tục trong lúc kéo).
- Giới hạn 50 bước. Mở file .cm mới → lịch sử undo reset sạch.

## Zoom canvas (phóng cả khung canvas)

- Zoom nhân vào **kích thước hiển thị** của canvas: khung canvas phình to/thu
  nhỏ theo, khung chứa cho phép **cuộn** khi canvas lớn hơn.
- **Cuộn chuột** trên canvas = zoom quanh vị trí con trỏ (điểm ảnh dưới con trỏ
  đứng yên nhờ bù scroll); **chụm 2 ngón** trên cảm ứng = zoom theo tỉ lệ
  khoảng cách 2 ngón.
- Cụm nút ở góc dưới-phải canvas: **−** / **% hiện tại** (bấm để về 100%) / **+** / **"Vừa khung"** (về 100%).
- Phạm vi 25%–400%. Độ phân giải nội bộ tăng theo zoom nên không mờ.
  Tọa độ chuột/chạm quy đổi theo tỉ lệ khung nên kéo/resize/chạm layer vẫn
  chính xác ở mọi mức zoom; file xuất (mockup/file in) luôn full-size gốc.
- **Kéo để di chuyển vùng nhìn khi zoom > 100%**: giữ **Space** + kéo ở bất cứ
  đâu trên canvas, hoặc kéo ở **vùng canvas trống** (không trúng layer) —
  vùng nhìn cuộn theo hướng kéo. Click vùng trống mà không di chuyển thì vẫn
  bỏ chọn như cũ; kéo trúng layer vẫn di chuyển layer; pan không ghi undo.
  Trên cảm ứng: 1 ngón kéo vùng trống = pan (canvas đã `touch-action: none`).

## Báo giá (panel "BÁO GIÁ")

- Nằm trong dock dưới canvas, cạnh panel "Xuất file".
- Chỉ 3 ô nhập: **Kiểu in** (DTF / DTG / In lụa / Decal / Thêu),
  **Số lượng** (mặc định 1), **Đơn giá** (VNĐ, mặc định 0).
- Ô **Đơn giá** tự định dạng dấu chấm nghìn khi gõ (gõ `45000` → hiện `45.000`);
  tính toán dùng giá trị số đã bóc dấu chấm; khi nạp cấu hình đã lưu cũng hiển thị
  dạng có dấu chấm.
- **Thành tiền** = Số lượng × Đơn giá, hiển thị to (định dạng 150.000đ),
  cập nhật realtime khi gõ.
- Cấu hình (kiểu in, số lượng, đơn giá) lưu trên máy (localStorage, key
  `mockupQuoteCfg`) và trong file .cm.
- **Phiếu kỹ thuật** và **thong-tin.txt** trong ZIP tự thêm mục "BÁO GIÁ"
  (Kiểu in / Số lượng / Đơn giá + Thành tiền) khi thành tiền > 0.
- Nút **"Xuất ảnh báo giá"**: tạo 1 ảnh PNG khổ dọc (1240px rộng, cao tự
  động theo nội dung) gồm: tiêu đề "BÁO GIÁ IN ÁO" + tên xưởng + ngày báo
  giá; tên khách hàng + mã đơn; ảnh mockup hiện tại (render từ luồng xuất
  mockup, giữ đúng tỉ lệ); **chi tiết in** — số mặt in, số vị trí in, từng
  vị trí (tên vị trí/mặt + kích thước cm, tự nhận diện theo 5 điểm preset),
  số màu in ("1 màu (tên màu)" khi bật in 1 màu, "Đa màu (in full màu)" khi
  giữ màu gốc), kiểu áo + màu áo; phần tiền (Kiểu in / Số lượng / Đơn giá /
  **THÀNH TIỀN** to đậm xanh #2F5ACF); dòng ghi chú hiệu lực 7 ngày.
  Logo xưởng (`assets/Logo.png`) ở **góc trên bên phải** của phiếu (cao 64px,
  giữ đúng tỉ lệ; lỗi/không tải được thì bỏ qua, không hỏng ảnh).
  Ảnh hiện qua modal xem trước tái dùng (có nút "Tải PNG về máy", chạm-giữ
  để lưu trên iOS/app chat). Vẫn xuất được khi chưa có layer (ghi
  "Chưa có hình in").

## Panel "Chất lượng & Xử lý" (gộp đánh giá + xử lý)

- Trên cùng: huy hiệu DPI (Đạt chuẩn in / Nên xử lý thêm / Không nên in) + dòng
  mô tả khổ in.
- **DPI ≥ 300 (đạt chuẩn)**: các nút đề xuất (Chuyển vector / Phóng nét 2×/4×)
  ở trạng thái **mờ (disabled)** + nhãn "Đã đạt 300dpi — không cần xử lý thêm."
- **DPI < 300**: đề xuất hiện rõ, nút được gợi ý tô đậm (vector cho hình phẳng
  ít màu, phóng nét 4× cho ảnh phức tạp). Bấm là **áp dụng ngay lên layer**,
  thấy kết quả realtime trên canvas (không mở modal so sánh).
- **Phím Escape đóng modal**: So sánh (= "Bỏ qua", không áp dụng), Cắt (= "Hủy"),
  Xem trước (= Đóng), Hướng dẫn (= Đóng). Nhiều modal chồng nhau thì đóng modal trên cùng.
  Không đóng khi đang gõ trong ô nhập liệu hoặc đang sửa tên layer.
- Nút "Xóa hình in" đã bỏ — xóa layer bằng nút × trên mỗi dòng trong panel Layers.
- **Phóng nét AI (tùy chọn)**: tick "Phóng nét bằng AI" thì 2×/4× chạy **UpscalerJS + TensorFlow.js**
  client-side (model 2× gọn ~80KB, tải lười từ CDN khi bấm lần đầu; 4× = 2 pass AI).
  Thiết bị không chạy được (WebGL lỗi/hết bộ nhớ/CDN bị chặn) thì app tự rơi về
  nội suy và **báo rõ, ở lại**: dòng cảnh báo trong panel ("⚠ Thiết bị này không chạy
  được AI — đã dùng phóng nét thường (nội suy) thay thế.") + toast cùng nội dung
  (toast cũ của nội suy bị ghi đè là có chủ ý). Dòng cảnh báo tự ẩn khi chạy xử lý
  khác thành công hoặc đổi layer. Trong lúc AI chạy, panel hiện "Đang tải model AI…" /
  "Đang phóng nét bằng AI…"; chạy AI thành công thì thông báo ghi rõ "Đã phóng nét AI 2×".
- Nút **"Tải trước model AI"** cạnh checkbox: tải model ngay (đúng cơ chế tải lười
  aiEnsure, dùng chung instance) để lần phóng nét sau chạy ngay không chờ; đang tải
  nút hiện "Đang tải model AI…" và khóa; xong → "Model AI đã sẵn sàng ✓" (giữ trạng thái
  trong phiên); lỗi → dòng cảnh báo + nút cho thử lại. Đã sẵn sàng rồi thì không tải lại.
- **Modal so sánh trước/sau** (khử nền trắng, vector): mở lên **luôn ở chế độ "Vừa khung"** —
  ảnh co theo đúng tỉ lệ gốc, vừa khung modal (không tràn/phóng to), nền caro hiển thị
  phần trong suốt. Chọn 100%/200%/400% thì **chỉ canvas phóng to** (cuộn ngang/dọc trong
  khung chứa nó, 2 phía cuộn đồng bộ để so sánh đúng vị trí); hàng nút mức zoom,
  tiêu đề, ghi chú và nút **"Bỏ qua"/"Áp dụng" đứng yên**, không bị zoom ảnh hưởng.
  Trên mobile 2 phía xếp dọc, mỗi phía cuộn trong khung riêng.

## Trạng thái nút bấm

- **Quy tắc (20261014q): CHỈ trạng thái "đang chọn" mới dùng nền đen** — đảo màu theo
  theme (sáng: nền đen chữ trắng; tối: nền trắng chữ đen). Không nút nào đen sẵn mặc
  định: nút chính (.primary như Tải file, Xuất mockup...) giờ nền như nút thường,
  chỉ giữ chữ đậm + bóng để phân biệt. Xanh accent chỉ còn cho viền focus gõ phím,
  khung layer đang chọn, đường gióng và badge.
- Mọi nút có hiệu ứng khi di chuột vào (chỉ trên thiết bị có chuột): nhấc nhẹ + bóng đổ;
  khi nhấn (:active) đảo màu đen như phản hồi "đã bấm/đang chọn". Không hiệu ứng thừa
  trên cảm ứng; tôn trọng chế độ giảm chuyển động của hệ thống.
- Các trạng thái "đang chọn" đều dùng đảo màu đen: **nút preset vị trí in** (đen khi
  layer đang chọn còn đúng vị trí + cỡ lúc áp preset — kéo tay/đổi cỡ/áp preset khác
  thì tự hết đen); **swatch** màu áo/màu in (vòng đen + phóng nhẹ); 2 ô chế độ in
  ("Giữ nguyên màu gốc" / "In 1 màu") thành pill đảo màu khi chọn; **"Hiện số đo"**
  khi bật thành pill đen; checkbox **"Phóng nét bằng AI"** khi tích thành pill đen;
  **mức zoom đang chọn** trong modal so sánh (.cmp-zoom.on) đảo màu đen; nút
  **Khóa khung** khi khóa đảo màu (đã có từ trước, cùng quy tắc).

## Dải tiêu đề đen + thang cỡ chữ (20261014r)

- Mọi panel chức năng (Layers, Layer đang chọn, Lịch sử, Chất lượng & Xử lý, Xuất file,
  Báo giá) có tiêu đề nằm trên **dải kiểu header** (14px/700/viết hoa/giãn chữ, tràn
  hết chiều ngang panel, bo 2 góc trên): **theme sáng = đen #000 chữ trắng; theme tối =
  trắng Coolmate #F8F8F8 chữ đen** (20261014t — đảo ngược dải đen để nổi rõ trên thân
  panel tối; trước đó bản 20261014s dùng đường phân cách sáng, không đủ nổi).
  Hộp modal có thêm viền nhẹ ở theme tối. Nút "Xóa tất cả" nằm trong dải của panel
  Lịch sử (kiểu ghost: sáng viền/chữ trắng, tối viền/chữ đen; hover đảo màu).
  Tiêu đề các modal (Cắt, So sánh, Xem trước, Hướng dẫn) cũng dùng dải đồng bộ.
- Thang cỡ chữ thống nhất: tiêu đề dải 14px · **nhãn mục con 12.5px/600** (Thông số áo,
  Màu file in...) · thân chính 13–14px · chữ phụ (.muted/.small/mô tả/ghi chú) 12–12.5px ·
  số THÀNH TIỀN giữ 18px (16px mobile) làm điểm nhấn.

## Lịch sử theo khách

- Panel **"Lịch sử"**: tự ghi 1 mục mỗi lần **xuất mockup / file in (PNG, SVG) / phiếu kỹ thuật /
  ảnh báo giá** hoặc **lưu file .cm** thành công.
- Mỗi mục gồm: giờ ghi, tên khách, mã đơn, kiểu áo + màu áo, tóm tắt từng layer
  (tên + kích thước cm + DPI), **ảnh thu nhỏ 240px** của mockup, và **toàn bộ project**
  để **nạp lại 1 chạm** (nút "Nạp lại" — hỏi xác nhận trước khi thay thế workspace hiện tại).
- Lưu trên trình duyệt này trong **IndexedDB** (kho lưu dung lượng lớn, đủ cho file
  thiết kế nặng), **tối đa 30 mục**; lần đầu chạy bản này tự **di trú** dữ liệu cũ từ
  localStorage sang rồi xóa key cũ. Trình duyệt chặn IndexedDB thì tự rơi về
  localStorage (giữ hành vi cũ).
- Đầy quota thật (hiếm gặp): tự xóa mục cũ nhất; trường hợp xấu nhất thì lưu mục mới
  thiếu ảnh gốc (ghi chú "Thiếu ảnh gốc" — mục đó chỉ nạp được thông tin + cấu hình,
  không có hình in).
- Nút "Xóa" từng mục + nút **"Xóa tất cả"** (chỉ hiện khi có ít nhất 1 mục, có hỏi xác nhận).
- Bấm "Nạp lại" xong có toast xác nhận; mục thiếu ảnh gốc sẽ hỏi riêng và nạp
  ở chế độ chỉ thông tin/cấu hình.

## Bố cục giao diện

**Màu sắc** (theo brand Coolmate): chỉ dùng 3 màu chính — `#2F5ACF` (xanh Cerulean Blue,
màu accent/nút chính), `#F8F8F8` (Alabaster, nền sáng), `#000000` (đen, chữ/nền tối).
Dark mode: nền đen, chữ trắng, accent xanh sáng `#5B7FE8`.
- **Header**: logo PNG nhúng trực tiếp (data URL) + tiêu đề
  "XƯỞNG IN MẪU" căn giữa viết hoa. Font **Be Vietnam Pro** (Google Fonts,
  hỗ trợ tốt tiếng Việt). **Bấm vào logo = làm mới app** (nếu đang có layer thì hỏi
  xác nhận trước khi tải lại trang).
- **Desktop (≥1024px)**: canvas lớn bên trái, sidebar phải (Layers + Layer đang
  chọn), hàng panel ngang **dưới canvas** (Chất lượng & Xử lý, Xuất file,
  File làm việc, Nâng cao) để thao tác realtime trực tiếp trên ảnh.
- **Mobile (≤768px)**: xếp dọc 1 cột (canvas → Layers → panel đang chọn → các panel dock).
  Khung canvas ôm khít ảnh (không còn dải đen thừa). Header thu nhỏ (logo 30px +
  tên 19px vừa 1 hàng). Toolbar chia thành các hàng rõ ràng: Mockup (hết hàng) →
  Màu áo + swatch 28px → Tải file / Lưu / Mở file chia đều → nút hoàn tác/làm lại
  + "Hiện số đo" + nút theme (đẩy sang phải). Thanh zoom thu gọn. Nút trong panel
  cao ≥40px để dễ bấm. Không tràn ngang ở màn hình 390px.
- **Mượt mà**: transition cho nút bấm/theme/panel/toast/modal; micro-interaction
  (nhấn nút, chọn layer); animation khi thêm layer mới. Tôn trọng
  `prefers-reduced-motion`.

## Thêm mockup mới (chỉ cần ảnh + JSON, không sửa code)

1. Chụp/Render ảnh áo: **mặt trước bên trái, mặt sau bên phải**, áo trắng
   hoặc sáng màu, **tách nền thành PNG trong suốt** (alpha = vùng áo).
   Vân vải càng tương phản mạnh thì đổi màu áo càng đẹp (multiply giữ nguyên
   chi tiết).
2. Copy file JSON mẫu trong `mockups/`, đặt tên ví dụ `mockups/hoodie.json`.
3. Điền các trường:
   - `ten`, `fileAnh` (đường dẫn tương đối từ root, VD `"Hoodie.png"` —
     ảnh PNG **nền trong suốt**, áo trắng/sáng màu tách nền sẵn; alpha của
     ảnh chính là vùng áo để nhuộm màu, không cần file mask riêng),
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

1. Chọn mockup (áo cổ tròn / polo), chọn **màu áo** (swatch trên toolbar).
2. Tải file thiết kế lên (kéo-thả hoặc nút "Tải file thiết kế") — mỗi file là
   **1 layer**, đặt ở giữa ngực trước với cỡ in mặc định. App tự đánh giá DPI
   và đề xuất giữ nguyên / chuyển vector / phóng nét — bạn chốt tay sau khi so
   sánh trước/sau ở 100%.
3. **Thao tác trực tiếp trên canvas**: bấm vào hình để chọn layer, kéo di chuyển
   tự do, kéo 4 góc thu/phóng (luôn khóa tỉ lệ). Phím tắt **Ctrl+C / Ctrl+V /
   Del** để copy / paste / xóa layer (**Del hỏi xác nhận trước khi xóa**; nút × trên
   khung chọn và trong panel xóa ngay như cũ). Bật **"Hiện số đo"** để xem:
   khung + kích thước từng hình in, **vùng in an toàn** (nét đứt xanh lá, full
   chiều dài thân áo trừ vùng cổ/nẹp/đường may, mặt trước + mặt sau). Khi kéo
   layer tràn ra ngoài vùng an toàn hoặc đè lên vùng cấm (cổ, nẹp nút), cảnh báo
   hiện ngay trong lúc kéo. Bấm nút tròn đỏ **×** để xóa nhanh.
   App cũng **cảnh báo khi màu hình in gần giống màu áo** (lên áo có thể không nổi).
4. **Xuất mockup PNG** gửi khách duyệt.
5. Khách chốt thì **lưu file làm việc (.cm)** — tải file về máy, tên file theo **mã đơn hàng** (VD: DH-2026-001.cm). File chứa toàn bộ layers + thông số.
6. Sau này chỉnh sửa: **mở file .cm** để khôi phục toàn bộ workspace → **xuất file in PNG/SVG** — mỗi layer ra
   một file riêng, 300dpi, đúng khổ cm, nền trong suốt, tên file theo tên layer.

## Màu file in (panel "Xuất file")

- **Giữ nguyên màu gốc** (mặc định): dùng cho in ảnh — mọi đầu ra giữ màu thật.
- **In 1 màu** (dùng cho in logo): chọn màu bằng ô màu hoặc swatch có sẵn
  (đen, trắng, đỏ, xanh navy, vàng, xanh lá). Khi bật, **mọi chỗ dùng design
  đều đổi màu**: mockup preview, mockup PNG, file in PNG (thường + theo vị trí),
  file in SVG (thường + theo vị trí), xuất hàng loạt.
- Raster: ép 1 màu bằng `source-in` (giữ nguyên độ trong suốt alpha gốc).
  SVG: thay mọi `fill="..."` thành màu đã chọn, giữ `fill-rule="evenodd"`.
- Tùy chọn màu được lưu vào file làm việc và in ra phiếu kỹ thuật.

## Màu áo (trên toolbar)

- Cuối toolbar có nút tròn **"?"** (cạnh nút sáng/tối) mở cửa sổ **Hướng dẫn sử dụng** đầy đủ 13 mục (bắt đầu, thao tác canvas, phím tắt, zoom, Layers, vị trí in, màu áo/in, chất lượng & xử lý, lưu/mở .cm, xuất file, báo giá, lịch sử, số đo). Link "Xem hướng dẫn đầy đủ" ở dòng gợi ý dưới canvas mở cùng cửa sổ. Modal đóng bằng nút ×, bấm ra ngoài hoặc Esc; nội dung cuộn trong thân, tối đa 85vh.

- Hàng swatch tròn trên toolbar (cùng hàng với dropdown Mockup và nút tải file):
  Trắng (mặc định), Đen, Navy, Đỏ đô, Xanh dương, Xanh rêu, Xám, Hồng, Vàng,
  Cam. Bấm là đổi màu áo ngay trên mockup (kèm tên màu).
- Cách nhuộm: phủ một lớp màu lên ảnh áo với blend **multiply** — đúng ý
  tưởng "phủ màu lên áo". Ảnh PNG mới có vân vải tương phản mạnh nên multiply
  thuần đã giữ đúng chi tiết vải, không cần xử lý thêm. Vùng trong suốt được
  giữ nguyên bằng `destination-in` với chính ảnh gốc (alpha của PNG là mask).
- Vì PNG nền trong suốt, canvas vẽ thêm **nền studio** (gradient xám nhạt
  `#f2f2f2 → #e2e2e2 → #d4d4d4`) bên dưới áo — cả preview lẫn file mockup PNG
  xuất ra đều có nền này.
- Nền đã nhuộm được **cache theo (mẫu áo + màu)** nên đổi qua lại không phải
  tính lại. Màu trắng = dùng thẳng ảnh gốc, không tính toán gì thêm.
- **Hình in trên áo tối** (độ sáng màu áo < 0.45, VD đen/navy): app tự chuyển
  sang vẽ đè trực tiếp (`source-over`, alpha 0.96) thay vì multiply — vì
  multiply trên nền tối làm hình in mất hút.
- **Hình SÁNG** (độ sáng artwork > 0.7, VD logo trắng): LUÔN vẽ đè trực tiếp
  (`source-over`, alpha 0.96) — vì multiply (trắng × màu áo) làm hình tàng hình
  trên áo trắng, xám, cam, be...; mockup phải nhìn thấy hình để còn căn chỉnh.
  Độ sáng artwork được tính trong `analyzeArtwork()` (trung bình luminance
  pixel đục, thumbnail 160px) và lưu theo layer (kể cả khi lưu/mở project).
- Các trường hợp còn lại (hình tối trên áo sáng): multiply để hình hòa vào
  chất vải như ảnh chụp thật.
- Màu áo được **lưu vào file làm việc** (mở lại là giữ nguyên) và in ra
  **phiếu kỹ thuật** gửi nhà in.
- **Chú thích tương phản:** khung hình in và vùng in an toàn tự đổi sang bảng
  màu sáng khi áo tối (độ sáng < 0.45): khung `#60a5fa`, vùng an toàn `#34d399`
  — thay vì bảng màu đậm dùng cho áo sáng (`#1d4ed8`, `#0e7c5b`). Nhãn pill
  giữ nền trắng nên luôn đọc được. Hàng chú thích (legend) ngoài canvas đổi
  màu chip theo cùng bảng màu.
- **"Hiện số đo"** chỉ hiện kích thước **hình in** (khung + line + nhãn
  "tên · R × C cm" cho từng layer) và 2 khung **vùng in an toàn** (nét đứt,
  mặt trước + mặt sau) — không hiện số đo áo cho đỡ rối.
- **Cảnh báo vùng in an toàn:** khi layer đang chọn tràn ra ngoài cả 2 vùng an
  toàn (lấy từ `exportZone` trong config) hoặc đè lên vùng cấm (cổ áo, nẹp nút
  trong `warnZones`), thanh cảnh báo đỏ hiện ngay trong lúc kéo.

## Chống cache (quan trọng với Safari)

- CSS/JS trong `index.html` dùng mã `?v=` (VD `app.js?v=20261012e`): mỗi lần
  sửa code là **phải tăng mã** rồi push, nếu không Safari giữ bản cũ.
- JSON config (`mockups/*.json`) được `fetch` kèm `?v=` + hằng `APP_V` trong
  `js/app.js` — **mỗi lần sửa JSON cũng phải tăng `APP_V`** rồi push, nếu
  không Safari giữ JSON cũ (VD thiếu trường mới thêm → tính năng không chạy
  dù JS đã mới). Ảnh áo (`.png`) không cần chống cache.

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
- **Phóng nét 2×/4×:** mặc định là **nội suy nâng độ phân giải trong trình duyệt**,
  không thêm chi tiết thật. Muốn AI thật thì tick "Phóng nét bằng AI" trong panel
  Chất lượng (xem mục trên). Không tích hợp Magnific hay API upscale nào trong bản này (xử lý sau).
- **Chuyển vector:** contour tracing thật (lượng tử màu → marching squares →
  nối đường bao → SVG path), hợp nhất với **hình phẳng ít màu** (logo, chữ,
  graphic). Ảnh chụp/phức tạp tracing sẽ xấu — app tự đề xuất phóng nét thay.
- Mockup hiện tại chỉ có áo trắng/sáng màu (dùng multiply để hòa hình in).
