'use strict';
/* =====================================================================
   Studio Mockup In Áo — chạy hoàn toàn phía trình duyệt, không backend.
   Kiến trúc config-driven: mỗi mockup = 1 ảnh thật + 1 file JSON trong
   mockups/. Thêm mockup mới chỉ cần thêm ảnh + JSON, không sửa code.
   ===================================================================== */

// Mã phiên bản chống cache cho mọi file tải riêng (JSON config...).
// Safari giữ cache rất lì: mỗi lần sửa JSON là PHẢI đổi mã này rồi push.
const APP_V = '20261013e';

// ---------- Tiện ích ----------
const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const fmt = (n, d = 1) => {
  const v = Number(n);
  return Number.isFinite(v) ? v.toFixed(d).replace(/\.0+$/, '') : '—';
};
const esc = (s) => String(s ?? '').replace(/[&<>"']/g,
  (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

let toastTimer = null;
function toast(msg, ms = 2800) {
  const t = $('toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, ms);
}

// Tải file blob về máy
function download(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 5000);
}

// ---------- State toàn app ----------
const S = {
  cfg: null,            // config mockup đang dùng
  mockupId: 'tshirt',
  baseImg: null,        // ảnh áo thật
  off: document.createElement('canvas'), // canvas composite full-res
  // Layers kiểu Photoshop: mỗi file thiết kế tải lên = 1 layer, thao tác
  // trực tiếp trên canvas (bấm chọn, kéo di chuyển tự do, kéo góc thu/phóng).
  // Thứ tự mảng = z-order (đầu mảng = dưới cùng, cuối mảng = trên cùng).
  // Layer: {id, name, art, x, y, wCm, visible}
  //   x, y: tâm layer theo tỉ lệ 0-1 của ảnh gốc
  //   wCm: rộng (cm) — LUÔN khóa tỉ lệ gốc (hCm = wCm / aspect)
  //   art: {raster, svgText, w, h, aspect, name, kind, colorCount, typeLabel}
  layers: [],
  activeLayerId: null,  // id layer đang chọn
  ratioLocked: true,    // QUY TẮC CỨNG: luôn khóa tỉ lệ gốc
  drag: null,
  view: { dw: 0, dh: 0, dpr: 1 }, // ánh xạ ảnh gốc -> css px
};

// Layer đang được chọn (null nếu chưa có layer nào)
function activeLayer() {
  return S.layers.find((l) => l.id === S.activeLayerId) || null;
}
// Artwork của layer đang chọn (null nếu chưa có)
function activeArt() {
  const L = activeLayer();
  return L ? L.art : null;
}
// Vị trí + cỡ mặc định cho layer mới: giữa ngực trước (lấy từ config,
// fallback tọa độ cứng nếu config thiếu)
function defaultLayerPlacement() {
  const ps = (S.cfg && S.cfg.positions) || [];
  const p = ps.find((x) => x.id === 'nguc-truoc') || ps[0];
  if (p) return { x: p.center.x, y: p.center.y, wCm: p.khoInMacDinhCm || 28 };
  return { x: 0.25, y: 0.47, wCm: 28 };
}

// Tùy chọn màu file in: 'orig' = giữ nguyên màu gốc (in ảnh),
// 'single' = ép về 1 màu (in logo). Áp dụng cho MỌI đầu ra: mockup
// preview, mockup PNG, file in PNG (thường + theo vị trí), SVG.
S.printColor = { mode: 'orig', color: '#1a1a1a' };

// Màu áo mockup: phủ lớp màu lên ảnh PNG áo (blend multiply), giữ nguyên
// nếp vải/chi tiết vì ảnh PNG mới có vân vải tương phản mạnh.
// Alpha của chính file PNG là mask (vùng trong suốt không bị nhuộm).
// S._tintBase = cache nền đã nhuộm theo key (mockupId + màu áo).
S.shirtColor = '#ffffff';
S.shirtColorName = 'Trắng';
S.maskImg = null; // giữ cho tương thích, không dùng nữa (alpha PNG chính là mask)
S._tintBase = null;

// Raster dùng cho mọi đầu ra (đã áp dụng tùy chọn màu). Xử lý ảnh
// (vector/upscale/crop/khử nền) luôn chạy trên bản gốc, không qua đây.
// Kết quả được cache theo (màu + canvas gốc) để không tính lại mỗi render.
function printRaster(pl) {
  const art = pl && pl.art;
  if (!art) return null;
  if (S.printColor.mode !== 'single') return art.raster;
  const key = S.printColor.color + '|' + art.raster.width + 'x' + art.raster.height;
  if (pl._tint && pl._tint.key === key && pl._tint.src === art.raster) return pl._tint.cv;
  const cv = document.createElement('canvas');
  cv.width = art.raster.width; cv.height = art.raster.height;
  const ctx = cv.getContext('2d');
  ctx.drawImage(art.raster, 0, 0);
  ctx.globalCompositeOperation = 'source-in'; // giữ alpha gốc, tô 1 màu
  ctx.fillStyle = S.printColor.color;
  ctx.fillRect(0, 0, cv.width, cv.height);
  pl._tint = { key, src: art.raster, cv };
  return cv;
}

// SVG dùng cho mọi đầu ra: thay mọi fill="..." thành 1 màu đã chọn,
// giữ nguyên fill-rule evenodd và các thuộc tính khác.
function svgForPrint(svgText) {
  if (S.printColor.mode !== 'single' || !svgText) return svgText;
  const c = S.printColor.color;
  return String(svgText)
    .replace(/(\sfill\s*=\s*["'])[^"']*(["'])/gi, '$1' + c + '$2')
    .replace(/(<style[^>]*>[\s\S]*?)(<\/style>)/gi, (m, a, b) =>
      a.replace(/fill\s*:\s*[^;}]+/gi, 'fill:' + c) + b);
}

// Đồng bộ UI (radio + ô chọn màu + swatch) theo S.printColor
function syncSwatches() {
  document.querySelectorAll('#swatches .sw').forEach((b) => {
    b.classList.toggle('on', String(b.dataset.c).toLowerCase() === String(S.printColor.color).toLowerCase());
  });
}
function syncColorUI() {
  document.querySelectorAll('input[name="colorMode"]').forEach((r) => {
    r.checked = r.value === S.printColor.mode;
  });
  $('inpPrintColor').value = S.printColor.color;
  $('colorRow').hidden = S.printColor.mode !== 'single';
  syncSwatches();
}

// Đồng bộ UI màu áo (vòng chọn + tên màu + màu chip chú thích) theo S.shirtColor
function syncShirtColorUI() {
  document.querySelectorAll('#shirtSwatches .sw').forEach((b) => {
    b.classList.toggle('on', b.dataset.c === S.shirtColor);
  });
  $('shirtColorName').textContent = S.shirtColorName;
  // Legend ngoài canvas phải dùng đúng bảng màu đang vẽ trên canvas
  const P = pal();
  const chips = { lgFrame: P.frame, lgSafe: P.safe };
  Object.keys(chips).forEach((id) => { const el = $(id); if (el) el.style.borderColor = chips[id]; });
}

const MOCKUPS = [
  { id: 'tshirt', file: 'mockups/tshirt.json', ten: 'Áo cổ tròn' },
  { id: 'polo',   file: 'mockups/polo.json',   ten: 'Áo polo' },
];

// Config dự phòng khi mở file:// trực tiếp (fetch JSON bị chặn CORS)
const FALLBACK_CFG = {
  tshirt: {"ten": "Áo cổ tròn", "fileAnh": "Tshirt.png", "kichThuocAnh": {"w": 4052, "h": 2283}, "ao": {"kieu": "Áo cổ tròn", "size": "L", "ngangNgucCm": 52, "daiAoCm": 72, "ngangNgucPx": 1190}, "positions": [{"id": "nguc-truoc", "ten": "Ngực trước", "center": {"x": 0.254, "y": 0.47}, "zone": {"x0": 0.14, "x1": 0.37, "y0": 0.3, "y1": 0.68}, "exportZone": {"x0": 0.1, "x1": 0.41, "y0": 0.25, "y1": 0.75}, "khoInMacDinhCm": 28}, {"id": "logo-nguc-trai", "ten": "Logo ngực trái", "center": {"x": 0.185, "y": 0.33}, "zone": {"x0": 0.14, "x1": 0.24, "y0": 0.28, "y1": 0.4}, "exportZone": {"x0": 0.1, "x1": 0.41, "y0": 0.25, "y1": 0.75}, "khoInMacDinhCm": 10}, {"id": "lung", "ten": "Lưng", "center": {"x": 0.752, "y": 0.47}, "zone": {"x0": 0.64, "x1": 0.87, "y0": 0.28, "y1": 0.68}, "exportZone": {"x0": 0.6, "x1": 0.9, "y0": 0.25, "y1": 0.75}, "khoInMacDinhCm": 30}], "warnZones": [{"loai": "tron", "ten": "Cổ trước", "x": 0.254, "y": 0.055, "r": 0.035}, {"loai": "tron", "ten": "Cổ sau", "x": 0.752, "y": 0.045, "r": 0.03}]},
  polo: {"ten": "Áo polo", "fileAnh": "Polo.png", "kichThuocAnh": {"w": 3469, "h": 1933}, "ao": {"kieu": "Áo polo", "size": "L", "ngangNgucCm": 52, "daiAoCm": 72, "ngangNgucPx": 935}, "positions": [{"id": "nguc-truoc", "ten": "Ngực trước", "center": {"x": 0.244, "y": 0.48}, "zone": {"x0": 0.13, "x1": 0.36, "y0": 0.32, "y1": 0.68}, "exportZone": {"x0": 0.1, "x1": 0.39, "y0": 0.25, "y1": 0.75}, "khoInMacDinhCm": 26}, {"id": "logo-nguc-trai", "ten": "Logo ngực trái", "center": {"x": 0.175, "y": 0.34}, "zone": {"x0": 0.13, "x1": 0.23, "y0": 0.3, "y1": 0.42}, "exportZone": {"x0": 0.1, "x1": 0.39, "y0": 0.25, "y1": 0.75}, "khoInMacDinhCm": 9}, {"id": "lung", "ten": "Lưng", "center": {"x": 0.754, "y": 0.48}, "zone": {"x0": 0.64, "x1": 0.87, "y0": 0.3, "y1": 0.68}, "exportZone": {"x0": 0.6, "x1": 0.9, "y0": 0.25, "y1": 0.75}, "khoInMacDinhCm": 28}], "warnZones": [{"loai": "chunhat", "ten": "Nẹp nút", "x0": 0.228, "x1": 0.262, "y0": 0.06, "y1": 0.28}, {"loai": "tron", "ten": "Cổ trước", "x": 0.244, "y": 0.06, "r": 0.035}, {"loai": "tron", "ten": "Cổ sau", "x": 0.754, "y": 0.05, "r": 0.03}]}
};

// ---------- Bảng màu chú thích (line số đo, khung, vùng in) ----------
// Áo sáng dùng bảng SÁNG; áo tối (lum < 0.45) dùng bảng TỐI cho tương phản,
// vì các màu đậm bị chìm trên nền áo đen/navy. Nhãn pill giữ nền trắng nên
// vẫn đọc được — chỉ đổi màu chữ/viền theo bảng đang dùng.
const PALETTE_SANG = { chest: '#b45309', frame: '#1d4ed8', safe: '#0e7c5b', zone: '#6b7280' };
const PALETTE_TOI  = { chest: '#fbbf24', frame: '#60a5fa', safe: '#34d399', zone: '#d1d5db' };
// Bảng màu chú thích đang dùng — tính lại mỗi lần vẽ theo màu áo hiện tại.
function pal() { return shirtLum(S.shirtColor) < 0.45 ? PALETTE_TOI : PALETTE_SANG; }

// ---------- Tải mockup ----------
// Tải config JSON + ảnh áo thật. Lỗi fetch (mở file://) thì dùng config dự phòng.
async function loadMockup(id) {
  S.mockupId = id;
  const meta = MOCKUPS.find((m) => m.id === id);
  let cfg = null;
  try {
    cfg = await (await fetch(meta.file + '?v=' + APP_V)).json();
  } catch (e) {
    cfg = FALLBACK_CFG[id]; // mở trực tiếp file:// 
  }
  S.cfg = cfg;
  S.layers = []; // mockup mới -> layers mới
  S.activeLayerId = null;
  syncProcVisibility();
  S.baseImg = await loadImage(cfg.fileAnh);
  S._tintBase = null; // đổi mockup -> tính lại nền nhuộm
  // PNG nền trong suốt: alpha của ảnh chính là mask vùng áo, không cần mask riêng
  S.off.width = cfg.kichThuocAnh.w;
  S.off.height = cfg.kichThuocAnh.h;

  $('inpChest').value = cfg.ao.ngangNgucCm;

  fitStage();
  renderLayerList();
  updateShirtPanel(); updateSelPanel(); checkWarnings(); assess();
}

function loadImage(src) {
  return new Promise((res, rej) => {
    const im = new Image();
    im.onload = () => res(im);
    im.onerror = rej;
    im.src = src;
  });
}

// Số px ảnh tương ứng 1cm ngoài đời thực (suy từ ngang ngực; hiệu chuẩn được)
function pxPerCm() {
  return S.cfg.ao.ngangNgucPx / S.cfg.ao.ngangNgucCm;
}

// Hộp hình in theo px ảnh gốc (của một layer cụ thể).
// hCm suy từ wCm / aspect (luôn khóa tỉ lệ gốc).
function layerPxOf(layer) {
  const W = S.cfg.kichThuocAnh.w, H = S.cfg.kichThuocAnh.h;
  const ppc = pxPerCm();
  const w = layer.wCm * ppc, h = (layer.wCm / layer.art.aspect) * ppc;
  return { x: layer.x * W - w / 2, y: layer.y * H - h / 2, w, h };
}

// ---------- Render mockup chân thực ----------
// 1) Vẽ ảnh áo thật full-res làm nền.
// 2) Vẽ MỌI placement có artwork (mặt trước + lưng trên cùng một ảnh).
// 3) Mỗi design: warp nhẹ 24 lát theo sin, vẽ bằng multiply alpha 0.93
//    (trên áo trắng, nền trắng artwork tự biến mất, màu hòa vào vải).
// 4) Khôi phục chất vải: clip đúng bbox design, vẽ lại ảnh gốc bằng
//    overlay alpha 0.35 để nếp vải/bóng đổ hiện xuyên qua hình in.
// Độ sáng tương đối của màu hex (0-1) — quyết định cách hòa hình in vào áo:
// áo tối (lum < 0.45) thì multiply làm hình mất hút, phải vẽ đè trực tiếp.
function shirtLum(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || '').trim());
  if (!m) return 1;
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}


// Nền áo đã nhuộm màu (full-res), CACHE theo key = mockupId + màu áo.
// Màu trắng -> trả thẳng canvas ảnh gốc (không tính toán).
// Phủ lớp màu lên áo với blend multiply; alpha của chính PNG giữ vùng trong
// suốt (destination-in bằng ảnh gốc). Ảnh PNG mới có vân vải tương phản mạnh
// nên multiply thuần đã giữ đúng chi tiết, không cần khôi phục thêm.
// Toàn bộ bằng lệnh canvas, KHÔNG lặp pixel JS.
function getTintedBase() {
  const W = S.cfg.kichThuocAnh.w, H = S.cfg.kichThuocAnh.h;
  const key = S.mockupId + '|' + S.shirtColor;
  if (S._tintBase && S._tintBase.key === key) return S._tintBase.cv;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d');
  ctx.drawImage(S.baseImg, 0, 0, W, H);
  if (S.shirtColor.toLowerCase() !== '#ffffff') {
    const lay = document.createElement('canvas');
    lay.width = W; lay.height = H;
    const l = lay.getContext('2d');
    l.drawImage(S.baseImg, 0, 0, W, H);
    l.globalCompositeOperation = 'multiply'; // phủ màu, giữ nếp vải/chi tiết
    l.fillStyle = S.shirtColor;
    l.fillRect(0, 0, W, H);
    // giữ lại alpha gốc của PNG (vùng trong suốt không bị nhuộm thành đục)
    l.globalCompositeOperation = 'destination-in';
    l.drawImage(S.baseImg, 0, 0, W, H);
    ctx.drawImage(lay, 0, 0);
  }
  S._tintBase = { key, cv };
  return cv;
}

// Nền studio cho ảnh PNG trong suốt (gradient xám nhạt).
function drawBackdrop(ctx, W, H) {
  const gr = ctx.createLinearGradient(0, 0, 0, H);
  gr.addColorStop(0, '#f2f2f2');
  gr.addColorStop(0.7, '#e2e2e2');
  gr.addColorStop(1, '#d4d4d4');
  ctx.fillStyle = gr;
  ctx.fillRect(0, 0, W, H);
}

function composite(ctx, W, H) {
  ctx.save();
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  drawBackdrop(ctx, W, H); // PNG trong suốt -> cần nền studio
  ctx.drawImage(getTintedBase(), 0, 0, W, H);
  S.layers.forEach((layer) => {
    if (layer.visible && layer.art) drawOneDesign(ctx, W, H, layer);
  });
  ctx.restore();
}

// Vẽ một hình in (đã có ảnh nền) — dùng cho cả preview mockup và xuất mockup.
// Dùng printRaster() để tôn trọng tùy chọn màu file in (giữ nguyên / 1 màu).
function drawOneDesign(ctx, W, H, layer) {
  const r = layerPxOf(layer);
  const art = printRaster(layer);
  const fullScale = W / S.cfg.kichThuocAnh.w;
  const pad = Math.ceil(6 * fullScale);

  // Canvas tạm chứa design đã warp
  const tmp = document.createElement('canvas');
  tmp.width = Math.max(2, Math.ceil(r.w) + pad * 2);
  tmp.height = Math.max(2, Math.ceil(r.h) + pad * 2);
  const t = tmp.getContext('2d');
  const SLICES = 24, amp = 3 * fullScale; // biên warp 3px ở full-res
  const dw = tmp.width - pad * 2, dh = tmp.height - pad * 2;
  for (let i = 0; i < SLICES; i++) {
    const sx = (i / SLICES) * art.width;
    const sw = art.width / SLICES + 1;
    const dx = pad + (i / SLICES) * dw;
    const dww = dw / SLICES + 1;
    const dy = pad + Math.sin((i / (SLICES - 1)) * Math.PI) * amp;
    t.drawImage(art, sx, 0, sw, art.height, dx, dy, dww, dh);
  }

  ctx.save();
  // Chọn cách hòa hình in vào áo:
  // - Áo tối: vẽ đè trực tiếp (source-over) vì multiply làm hình mất hút.
  // - Hình SÁNG trên áo SÁNG: cũng vẽ đè trực tiếp — multiply (trắng × trắng)
  //   sẽ làm hình tàng hình, mockup phải NHÌN THẤY hình để còn căn chỉnh.
  // - Còn lại (hình tối trên áo sáng): multiply để hình hòa vào chất vải.
  const artBright = (layer.art && typeof layer.art.brightness === 'number')
    ? layer.art.brightness : 0.5;
  const sLum = shirtLum(S.shirtColor);
  if (sLum < 0.45 || (artBright > 0.75 && sLum > 0.6)) {
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 0.96;
  } else {
    ctx.globalCompositeOperation = 'multiply';
    ctx.globalAlpha = 0.93;
  }
  ctx.drawImage(tmp, r.x - pad, r.y - pad, tmp.width, tmp.height);
  ctx.restore();
}

const stage = $('stage');
const sctx = stage.getContext('2d');

// Vừa canvas hiển thị theo khung — LUÔN giữ đúng tỉ lệ W/H của ảnh gốc.
// (Bug cũ: dw lấy bằng cw trong khi dh = H*s khiến ảnh bị bóp dẹt khi
// maxH/H < cw/W. Fix: dw = W*s, căn giữa canvas trong khung.)
function fitStage() {
  if (!S.cfg) return;
  const wrap = $('canvasWrap');
  const cw = Math.max(280, wrap.clientWidth);
  const maxH = Math.max(320, Math.floor(window.innerHeight * 0.72));
  const { w: W, h: H } = S.cfg.kichThuocAnh;
  const s = Math.min(cw / W, maxH / H);
  const dw = Math.floor(W * s), dh = Math.floor(H * s); // đúng tỉ lệ ảnh gốc
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  stage.style.width = dw + 'px';
  stage.style.height = dh + 'px';
  stage.style.margin = '0 auto'; // căn giữa canvas trong khung
  stage.width = Math.round(dw * dpr);
  stage.height = Math.round(dh * dpr);
  S.view = { dw, dh, dpr };
  // Canvas đã có kích thước thật -> khung ôm khít, không để dải đen/trống (mobile)
  wrap.classList.add('fitted');
  render();
}

// Vẽ composite full-res rồi thu về canvas hiển thị + khung chọn
function render() {
  if (!S.cfg || !S.baseImg) return;
  const W = S.cfg.kichThuocAnh.w, H = S.cfg.kichThuocAnh.h;
  const octx = S.off.getContext('2d');
  octx.clearRect(0, 0, W, H);
  composite(octx, W, H);

  const { dw, dh, dpr } = S.view;
  sctx.setTransform(1, 0, 0, 1, 0, 0);
  sctx.clearRect(0, 0, stage.width, stage.height);
  sctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  sctx.imageSmoothingEnabled = true;
  sctx.imageSmoothingQuality = 'high';
  sctx.drawImage(S.off, 0, 0, dw, dh);
  drawSelection();
  drawMeasureOverlays();
  $('dropHint').style.display = S.layers.length ? 'none' : 'flex';
}

// Đổi tọa độ px ảnh gốc -> css px trên canvas hiển thị
function toCss(px, py) {
  return [
    (px / S.cfg.kichThuocAnh.w) * S.view.dw,
    (py / S.cfg.kichThuocAnh.h) * S.view.dh,
  ];
}

// Khung chọn + 4 tay cầm góc + nút xóa × ở góc trên-phải + tên layer
function drawSelection() {
  const L = activeLayer();
  if (!L || !L.art) return;
  const r = layerPxOf(L);
  const [x1, y1] = toCss(r.x, r.y);
  const [x2, y2] = toCss(r.x + r.w, r.y + r.h);
  sctx.save();
  sctx.strokeStyle = pal().safe;
  sctx.lineWidth = 1.5;
  sctx.setLineDash([6, 4]);
  sctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
  sctx.setLineDash([]);
  const HS = 9;
  sctx.fillStyle = pal().safe;
  [[x1, y1], [x2, y1], [x1, y2], [x2, y2]].forEach(([x, y]) => {
    sctx.fillRect(x - HS, y - HS, HS * 2, HS * 2);
  });
  // Tên layer phía trên khung chọn
  sctx.font = '11px system-ui, sans-serif';
  const tw = sctx.measureText(L.name).width;
  sctx.fillStyle = 'rgba(14,124,91,0.92)';
  const bx = clamp(x1, 2, S.view.dw - tw - 14), by = Math.max(2, y1 - 22);
  sctx.fillRect(bx, by, tw + 12, 18);
  sctx.fillStyle = '#ffffff';
  sctx.textAlign = 'left'; sctx.textBaseline = 'middle';
  sctx.fillText(L.name, bx + 6, by + 9.5);
  // Nút tròn đỏ dấu × ở góc trên-phải của khung chọn
  const db = deleteBtnCss();
  sctx.beginPath();
  sctx.arc(db.x, db.y, db.r, 0, Math.PI * 2);
  sctx.fillStyle = '#b91c1c';
  sctx.fill();
  sctx.lineWidth = 2;
  sctx.strokeStyle = '#ffffff';
  sctx.stroke();
  sctx.lineWidth = 2.5;
  sctx.beginPath();
  const k = 5;
  sctx.moveTo(db.x - k, db.y - k); sctx.lineTo(db.x + k, db.y + k);
  sctx.moveTo(db.x + k, db.y - k); sctx.lineTo(db.x - k, db.y + k);
  sctx.stroke();
  sctx.restore();
}

// Vị trí nút xóa × (tọa độ css px) — dùng chung cho vẽ và hit-test
function deleteBtnCss() {
  const L = activeLayer();
  const r = layerPxOf(L);
  const [x, y] = toCss(r.x + r.w, r.y);
  return { x, y, r: 13 };
}

// ---------- Lớp phủ số đo (toggle "Hiện số đo", mặc định bật) ----------
// - Số đo áo: line 2 đầu mũi tên ngang qua ngực ("52cm") + line dọc thân
//   ("72cm"); độ dài line = số cm trong config × pxPerCm (đúng tỉ lệ hiệu chuẩn).
// - Số đo hình in đang chọn: khung + line kích thước quanh bbox ("28 × 18.7 cm").
// Tất cả vẽ bằng toCss() nên luôn đúng tọa độ; nhãn có nền trắng cho dễ đọc.
function drawMeasureOverlays() {
  if (!S.cfg || !$('chkMeasure') || !$('chkMeasure').checked) return;
  const P = pal(); // bảng màu chú thích tương phản với màu áo hiện tại
  const W = S.cfg.kichThuocAnh.w, H = S.cfg.kichThuocAnh.h;
  const labels = []; // gom nhãn, vẽ SAU khi vẽ xong line để không bị line đè

  // 1) Vùng in an toàn: 2 khung nét đứt xanh lá (mặt trước + mặt sau).
  // Lấy từ exportZone trong config; không vẽ nhãn cho đỡ rối.
  sctx.save();
  sctx.strokeStyle = P.safe; sctx.lineWidth = 1.5;
  sctx.setLineDash([8, 6]);
  safeZones().forEach((z) => {
    const [x1, y1] = toCss(z.x0 * W, z.y0 * H);
    const [x2, y2] = toCss(z.x1 * W, z.y1 * H);
    sctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
  });
  sctx.restore();

  // 2) Khung + kích thước TỪNG layer visible (không hiện số đo áo).
  S.layers.forEach((L) => {
    if (!L.visible || !L.art) return;
    const r = layerPxOf(L);
    const d1 = toCss(r.x, r.y), d2 = toCss(r.x + r.w, r.y + r.h);
    sctx.save();
    sctx.strokeStyle = P.frame; sctx.lineWidth = 1.5;
    sctx.strokeRect(d1[0], d1[1], d2[0] - d1[0], d2[1] - d1[1]);
    sctx.restore();
    dimLine(d1[0], d2[1] + 30, d2[0], d2[1] + 30, P.frame);
    const wCm = L.wCm, hCm = L.wCm / L.art.aspect;
    let nm = L.name || 'layer';
    if (nm.length > 22) nm = nm.slice(0, 21) + '…';
    labels.push({
      x: (d1[0] + d2[0]) / 2, y: d2[1] + 30,
      text: `${nm} · ${fmt(wCm)} × ${fmt(hCm)} cm`, color: P.frame,
    });
  });

  // Vẽ nhãn sau cùng — pill trắng 11px, tự kẹp trong canvas
  labels.forEach((L) => pillLabel(L.x, L.y, L.text, L.color, 'center'));
}

// Line đo kích thước: đường thẳng + mũi tên 2 đầu (KHÔNG vẽ nhãn ở đây —
// nhãn được gom lại vẽ sau cùng để không chèn lên nhau / bị line đè)
function dimLine(x1, y1, x2, y2, color) {
  sctx.save();
  sctx.strokeStyle = color; sctx.fillStyle = color; sctx.lineWidth = 1.5;
  sctx.beginPath(); sctx.moveTo(x1, y1); sctx.lineTo(x2, y2); sctx.stroke();
  const ang = Math.atan2(y2 - y1, x2 - x1), AH = 8;
  [[x1, y1, ang + Math.PI], [x2, y2, ang]].forEach(([x, y, a2]) => {
    sctx.beginPath(); sctx.moveTo(x, y);
    sctx.lineTo(x + AH * Math.cos(a2 + 0.42), y + AH * Math.sin(a2 + 0.42));
    sctx.moveTo(x, y);
    sctx.lineTo(x + AH * Math.cos(a2 - 0.42), y + AH * Math.sin(a2 - 0.42));
    sctx.stroke();
  });
  sctx.restore();
}

// Nhãn pill: nền trắng, viền + chữ màu, chữ 11px.
// align 'center': pill căn giữa tại (x,y) | 'right': mép phải pill tại x.
function pillLabel(x, y, text, color, align) {
  const fs = 11;
  sctx.save();
  sctx.font = fs + 'px system-ui, sans-serif';
  const tw = sctx.measureText(text).width, pad = 6, h = 18;
  let bx = align === 'right' ? x - tw - pad * 2 : x - tw / 2 - pad;
  bx = clamp(bx, 2, Math.max(2, S.view.dw - tw - pad * 2 - 2));
  const by = clamp(y - h / 2, 2, Math.max(2, S.view.dh - h - 2));
  sctx.fillStyle = 'rgba(255,255,255,0.95)';
  sctx.strokeStyle = color; sctx.lineWidth = 1;
  if (sctx.roundRect) {
    sctx.beginPath();
    sctx.roundRect(bx, by, tw + pad * 2, h, 9);
    sctx.fill(); sctx.stroke();
  } else {
    sctx.fillRect(bx, by, tw + pad * 2, h);
    sctx.strokeRect(bx, by, tw + pad * 2, h);
  }
  sctx.fillStyle = color;
  sctx.textAlign = 'center'; sctx.textBaseline = 'middle';
  sctx.fillText(text, bx + tw / 2 + pad, by + h / 2 + 0.5);
  sctx.restore();
}

// ---------- Tương tác: kéo di chuyển / kéo góc thu-phóng (giữ tỉ lệ) ----------
function evtImg(e) {
  const rect = stage.getBoundingClientRect();
  const cx = e.clientX - rect.left, cy = e.clientY - rect.top;
  return {
    x: (cx / S.view.dw) * S.cfg.kichThuocAnh.w,
    y: (cy / S.view.dh) * S.cfg.kichThuocAnh.h,
  };
}

function hitHandle(p) {
  const L = activeLayer();
  if (!L || !L.art) return -1;
  const r = layerPxOf(L);
  const corners = [[r.x, r.y], [r.x + r.w, r.y], [r.x, r.y + r.h], [r.x + r.w, r.y + r.h]];
  const R = (16 / S.view.dw) * S.cfg.kichThuocAnh.w; // ~16 css px
  for (let i = 0; i < 4; i++) {
    const dx = p.x - corners[i][0], dy = p.y - corners[i][1];
    if (dx * dx + dy * dy <= R * R) return i;
  }
  return -1;
}

// Bấm vào canvas: ưu tiên nút × xóa, rồi tay cầm thu/phóng của layer đang
// chọn, rồi hit-test từ layer trên cùng xuống (bấm trúng layer nào thì chọn
// layer đó và kéo di chuyển tự do). Bấm ra ngoài mọi layer thì bỏ chọn.
stage.addEventListener('pointerdown', (e) => {
  if (!S.cfg || !S.baseImg) return;
  const p = evtImg(e);
  const L = activeLayer();
  // Ưu tiên nút xóa × ở góc trên-phải khung chọn (trước mọi thao tác kéo)
  if (L && L.art) {
    const cssX = (p.x / S.cfg.kichThuocAnh.w) * S.view.dw;
    const cssY = (p.y / S.cfg.kichThuocAnh.h) * S.view.dh;
    const db = deleteBtnCss();
    if (Math.hypot(cssX - db.x, cssY - db.y) <= db.r + 6) {
      deleteLayer(L.id);
      e.preventDefault();
      return;
    }
    // Tay cầm 4 góc của layer đang chọn -> thu/phóng (giữ tỉ lệ)
    if (hitHandle(p) >= 0) {
      const r = layerPxOf(L);
      S.drag = {
        mode: 'scale', layerId: L.id,
        cx: r.x + r.w / 2, cy: r.y + r.h / 2,
        d0: Math.hypot(p.x - (r.x + r.w / 2), p.y - (r.y + r.h / 2)),
        w0: L.wCm,
      };
      stage.setPointerCapture(e.pointerId);
      stage.style.cursor = 'grabbing';
      e.preventDefault();
      return;
    }
  }
  // Hit-test layers từ trên cùng xuống dưới
  for (let i = S.layers.length - 1; i >= 0; i--) {
    const lay = S.layers[i];
    if (!lay.visible || !lay.art) continue;
    const r = layerPxOf(lay);
    if (p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h) {
      if (lay.id !== S.activeLayerId) setActiveLayer(lay.id, true);
      S.drag = { mode: 'move', layerId: lay.id, ox: p.x - r.x, oy: p.y - r.y };
      stage.setPointerCapture(e.pointerId);
      stage.style.cursor = 'grabbing';
      e.preventDefault();
      return;
    }
  }
  // Bấm ra ngoài: bỏ chọn layer
  if (S.activeLayerId) setActiveLayer(null);
});

function dragLayer() {
  return S.drag ? S.layers.find((l) => l.id === S.drag.layerId) : null;
}

stage.addEventListener('pointermove', (e) => {
  if (!S.drag) return;
  const lay = dragLayer();
  if (!lay || !lay.art) { S.drag = null; return; }
  const p = evtImg(e);
  const W = S.cfg.kichThuocAnh.w, H = S.cfg.kichThuocAnh.h;
  if (S.drag.mode === 'move') {
    const r = layerPxOf(lay);
    lay.x = clamp((p.x - S.drag.ox + r.w / 2) / W, 0, 1);
    lay.y = clamp((p.y - S.drag.oy + r.h / 2) / H, 0, 1);
  } else {
    const d = Math.hypot(p.x - S.drag.cx, p.y - S.drag.cy);
    if (d > 4 && S.drag.d0 > 4) setLayerWidth(lay, (S.drag.w0 * d) / S.drag.d0);
  }
  render(); updateSelPanel(); checkWarnings();
});

const endDrag = () => { S.drag = null; stage.style.cursor = 'grab'; };
stage.addEventListener('pointerup', endDrag);
stage.addEventListener('pointercancel', endDrag);

// ---------- Kích thước in (cm): 2 ô tự đồng bộ, LUÔN giữ tỉ lệ gốc ----------
// Áp dụng cho layer đang chọn (wCm là nguồn chân lý, hCm suy từ aspect).
function setLayerWidth(layer, wCm) {
  layer.wCm = clamp(wCm, 1, 200);
  syncSizeInputs();
}
function setPrintWidth(wCm) {
  const L = activeLayer();
  if (L) setLayerWidth(L, wCm);
}
function setPrintHeight(hCm) {
  const L = activeLayer();
  if (!L || !L.art || hCm <= 0) return;
  setLayerWidth(L, hCm * L.art.aspect);
}
function syncSizeInputs() {
  const L = activeLayer();
  if (!L || !L.art) {
    $('inpW').value = ''; $('inpH').value = '';
    $('lockRatio').textContent = '—';
    return;
  }
  $('inpW').value = fmt(L.wCm);
  $('inpH').value = fmt(L.wCm / L.art.aspect);
  $('lockRatio').textContent = 'tỉ lệ ' + ratioText(L.art.aspect);
}
// Hiển thị tỉ lệ dạng "16:9" gần đúng
function ratioText(a) {
  for (let d = 1; d <= 12; d++) {
    const n = Math.round(a * d);
    if (Math.abs(n / d - a) < 0.02) return n + ':' + d;
  }
  return a.toFixed(2) + ':1';
}

// =====================================================================
// PHẦN 2: Upload artwork (PNG/JPG/WEBP/SVG/AI/EPS), khử nền trắng, crop
// =====================================================================

function needArt() {
  if (!activeArt()) { toast('Hãy tải file thiết kế lên trước.'); return false; }
  return true;
}

$('btnUpload').onclick = () => $('fileInput').click();
$('fileInput').addEventListener('change', (e) => {
  handleFiles(e.target.files);
  e.target.value = '';
});

// Kéo-thả file vào canvas
const wrap = $('canvasWrap');
['dragenter', 'dragover'].forEach((ev) =>
  wrap.addEventListener(ev, (e) => { e.preventDefault(); wrap.classList.add('dragover'); })
);
['dragleave', 'drop'].forEach((ev) =>
  wrap.addEventListener(ev, (e) => { e.preventDefault(); wrap.classList.remove('dragover'); })
);
wrap.addEventListener('drop', (e) => handleFiles(e.dataTransfer.files));

// Nhận file upload, phân loại theo đuôi file
async function handleFiles(files) {
  const f = files && files[0];
  if (!f) return;
  const ext = (f.name.split('.').pop() || '').toLowerCase();
  toast('Đang đọc file...');
  try {
    if (['png', 'jpg', 'jpeg', 'webp'].includes(ext)) {
      await setArtwork(await rasterFromFile(f), f.name, 'raster', null);
    } else if (ext === 'svg') {
      const text = await f.text();
      const cv = await rasterizeSVG(text, 1600);
      await setArtwork(cv, f.name, 'svg-file', text); // giữ SVG gốc để xuất file in
    } else if (['ai', 'eps', 'pdf'].includes(ext)) {
      const cv = await rasterFromPDF(f); // thử đọc như PDF (file .ai thường có nhân PDF)
      await setArtwork(cv, f.name, 'raster', null);
    } else {
      throw new Error('UNSUPPORTED');
    }
  } catch (err) {
    console.error(err);
    if (err && err.message === 'PDF_READ_FAIL') {
      toast('Không đọc được file .ai/.eps này (có thể là PostScript thuần, không có nhân PDF). Hãy mở bằng Illustrator rồi lưu lại dạng PDF hoặc SVG rồi tải lên.', 6500);
    } else if (err && err.message === 'PDFJS_MISSING') {
      toast('Thiếu thư viện PDF.js (cần mạng ở lần đầu). Hãy tải file dưới dạng PNG/JPG/SVG.', 5000);
    } else {
      toast('Không đọc được file này. Hãy thử PNG/JPG/WEBP/SVG.', 4000);
    }
  }
}

// Đọc ảnh raster thành canvas (giữ nguyên kích thước gốc)
function rasterFromFile(file) {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(file);
    const im = new Image();
    im.onload = () => {
      const cv = document.createElement('canvas');
      cv.width = im.naturalWidth; cv.height = im.naturalHeight;
      cv.getContext('2d').drawImage(im, 0, 0);
      URL.revokeObjectURL(url);
      res(cv);
    };
    im.onerror = () => { URL.revokeObjectURL(url); rej(new Error('IMG_FAIL')); };
    im.src = url;
  });
}

// Vẽ SVG ra canvas để hiển thị/làm mockup (vector gốc vẫn giữ trong svgText)
function rasterizeSVG(svgText, targetW = 1600) {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(new Blob([svgText], { type: 'image/svg+xml' }));
    const im = new Image();
    im.onload = () => {
      const sc = targetW / im.naturalWidth;
      const cv = document.createElement('canvas');
      cv.width = Math.max(1, Math.round(im.naturalWidth * sc));
      cv.height = Math.max(1, Math.round(im.naturalHeight * sc));
      cv.getContext('2d').drawImage(im, 0, 0, cv.width, cv.height);
      URL.revokeObjectURL(url);
      res(cv);
    };
    im.onerror = () => { URL.revokeObjectURL(url); rej(new Error('SVG_FAIL')); };
    im.src = url;
  });
}

// Đọc .ai/.eps bằng PDF.js (file .ai lưu mặc định kèm nhân PDF). Render trang 1 ở 300dpi.
async function rasterFromPDF(file) {
  if (typeof pdfjsLib === 'undefined') throw new Error('PDFJS_MISSING');
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  try {
    const buf = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
    const page = await pdf.getPage(1);
    const vp = page.getViewport({ scale: 300 / 72 });
    const cv = document.createElement('canvas');
    cv.width = Math.ceil(vp.width); cv.height = Math.ceil(vp.height);
    await page.render({ canvasContext: cv.getContext('2d'), viewport: vp }).promise;
    return cv;
  } catch (e) {
    throw new Error('PDF_READ_FAIL');
  }
}

// Nhận artwork mới: tạo 1 LAYER mới (kiểu Photoshop) đặt ở giữa ngực trước
// với cỡ in mặc định, rồi đánh giá chất lượng ở đúng khổ đó.
async function setArtwork(rasterCanvas, name, kind, svgText) {
  const w = rasterCanvas.width, h = rasterCanvas.height;
  if (!w || !h) throw new Error('EMPTY');
  const art = { raster: rasterCanvas, svgText, w, h, aspect: w / h, name, kind, colorCount: 0, typeLabel: '', brightness: 1 };
  const an = analyzeArtwork(rasterCanvas);
  art.colorCount = an.colors;
  art.brightness = an.brightness;
  art.typeLabel = an.kind === 'flat' ? 'Hình phẳng, ít màu' : 'Ảnh phức tạp';
  const dp = defaultLayerPlacement();
  const layer = {
    id: 'L' + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36),
    name, art, x: dp.x, y: dp.y, wCm: dp.wCm, visible: true,
  };
  S.layers.push(layer);
  S.activeLayerId = layer.id;
  syncProcVisibility();
  assess();
  render(); renderLayerList(); updateSelPanel(); checkWarnings();
  updateSelPanel();
  toast('Đã thêm layer mới — kéo để di chuyển tự do.');
}

// ---------- Khử nền trắng ----------
// Pixel gần trắng thành trong suốt (viền feather nhẹ). Giữ nguyên kích thước/tỉ lệ.
function btnWhite() {
  if (!needArt()) return;
  const src = activeArt().raster;
  const cv = document.createElement('canvas');
  cv.width = src.width; cv.height = src.height;
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(src, 0, 0);
  const id = ctx.getImageData(0, 0, cv.width, cv.height), d = id.data;
  for (let i = 0; i < d.length; i += 4) {
    const m = Math.min(d[i], d[i + 1], d[i + 2]);
    if (m > 242) d[i + 3] = 0;
    else if (m > 226) d[i + 3] = Math.round(d[i + 3] * ((242 - m) / 16));
  }
  ctx.putImageData(id, 0, 0);
  openCompare(src, cv, 'So sánh: gốc vs khử nền trắng',
    'Pixel gần trắng đã thành trong suốt. Nếu viền hình bị ăn mòn, bấm “Bỏ qua”.',
    () => {
      const a = activeArt();
      a.raster = cv; a.svgText = null; a.kind = 'raster';
      afterProcess('Đã khử nền trắng.');
    });
}

// ---------- Crop: mở modal, kéo khung chữ nhật, áp dụng ----------
// Crop tạo artwork mới (tỉ lệ mới = tỉ lệ khung crop) — không làm méo hình.
let cropSt = null;

function openCrop() {
  if (!needArt()) return;
  const src = activeArt().raster;
  const cv = $('cropCanvas');
  const sc = Math.min(1, 880 / src.width);
  cv.width = Math.max(2, Math.round(src.width * sc));
  cv.height = Math.max(2, Math.round(src.height * sc));
  cropSt = { sc, x0: 0, y0: 0, x1: 0, y1: 0, drawing: false };
  drawCrop();
  $('modalCrop').hidden = false;
}

function drawCrop() {
  const cv = $('cropCanvas'), ctx = cv.getContext('2d');
  const src = activeArt().raster;
  ctx.clearRect(0, 0, cv.width, cv.height);
  ctx.drawImage(src, 0, 0, cv.width, cv.height);
  const s = cropSt;
  const x0 = Math.min(s.x0, s.x1), x1 = Math.max(s.x0, s.x1);
  const y0 = Math.min(s.y0, s.y1), y1 = Math.max(s.y0, s.y1);
  if (x1 > x0 + 2 && y1 > y0 + 2) {
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.save();
    ctx.beginPath(); ctx.rect(x0, y0, x1 - x0, y1 - y0); ctx.clip();
    ctx.drawImage(src, 0, 0, cv.width, cv.height);
    ctx.restore();
    ctx.strokeStyle = '#0e7c5b'; ctx.lineWidth = 2;
    ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);
  }
}

const cropCv = $('cropCanvas');
cropCv.addEventListener('pointerdown', (e) => {
  if (!cropSt) return;
  const r = cropCv.getBoundingClientRect();
  cropSt.x0 = cropSt.x1 = e.clientX - r.left;
  cropSt.y0 = cropSt.y1 = e.clientY - r.top;
  cropSt.drawing = true;
  cropCv.setPointerCapture(e.pointerId);
});
cropCv.addEventListener('pointermove', (e) => {
  if (!cropSt || !cropSt.drawing) return;
  const r = cropCv.getBoundingClientRect();
  cropSt.x1 = e.clientX - r.left;
  cropSt.y1 = e.clientY - r.top;
  drawCrop();
});
cropCv.addEventListener('pointerup', () => { if (cropSt) cropSt.drawing = false; });

function applyCrop() {
  const s = cropSt;
  const x0 = Math.min(s.x0, s.x1), x1 = Math.max(s.x0, s.x1);
  const y0 = Math.min(s.y0, s.y1), y1 = Math.max(s.y0, s.y1);
  if (!s || x1 <= x0 + 2 || y1 <= y0 + 2) {
    toast('Hãy kéo một khung chữ nhật trên ảnh trước.');
    return;
  }
  const src = activeArt().raster;
  const x = clamp(Math.round(x0 / s.sc), 0, src.width - 1);
  const y = clamp(Math.round(y0 / s.sc), 0, src.height - 1);
  const w = clamp(Math.round((x1 - x0) / s.sc), 1, src.width - x);
  const h = clamp(Math.round((y1 - y0) / s.sc), 1, src.height - y);
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  cv.getContext('2d').drawImage(src, x, y, w, h, 0, 0, w, h);
  const a = activeArt();
  a.raster = cv; a.svgText = null; a.kind = 'raster';
  a.w = w; a.h = h; a.aspect = w / h;
  $('modalCrop').hidden = true;
  afterProcess('Đã cắt artwork theo khung.');
}

// =====================================================================
// PHẦN 3: Đánh giá chất lượng in, so sánh trước/sau, vector tracing, upscale
// =====================================================================

// DPI thực tế = pixel artwork / khổ in (inch). Lấy chiều nhỏ nhất (trường hợp xấu nhất).
function artworkDPI() {
  const L = activeLayer();
  if (!L || !L.art) return 0;
  const wCm = L.wCm, hCm = L.wCm / L.art.aspect;
  const dpiW = L.art.w / (wCm / 2.54);
  const dpiH = L.art.h / (hCm / 2.54);
  return Math.min(dpiW, dpiH);
}

// Phân loại artwork: đếm số màu (lượng tử 4 bit/kênh) + độ sáng trung bình
// trên ảnh thu nhỏ. Ít màu -> "flat" (hợp vector); nhiều màu -> "photo"
// (hợp phóng nét). brightness 0-1 dùng để chọn cách hòa hình vào áo
// (hình trắng trên áo trắng dùng multiply sẽ tàng hình).
function analyzeArtwork(canvas) {
  const MAX = 160;
  const sc = Math.min(1, MAX / Math.max(canvas.width, canvas.height));
  const w = Math.max(1, Math.round(canvas.width * sc));
  const h = Math.max(1, Math.round(canvas.height * sc));
  const t = document.createElement('canvas');
  t.width = w; t.height = h;
  const ctx = t.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(canvas, 0, 0, w, h);
  const d = ctx.getImageData(0, 0, w, h).data;
  const set = new Set();
  let lumSum = 0, lumN = 0;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 128) continue;
    set.add(((d[i] >> 4) << 8) | ((d[i + 1] >> 4) << 4) | (d[i + 2] >> 4));
    lumSum += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
    lumN++;
    if (set.size > 200) break;
  }
  const colors = set.size;
  const brightness = lumN ? lumSum / lumN / 255 : 1;
  return { colors, kind: colors <= 40 ? 'flat' : 'photo', brightness };
}

// Đánh giá chất lượng + đề xuất xử lý TRONG CÙNG 1 panel.
// Logic: DPI >= 300 (đạt chuẩn) -> các nút đề xuất MỜ (disabled), chỉ hiện
// nhãn "Đã đạt 300dpi". DPI < 300 -> đề xuất hiện rõ, bấm là ÁP DỤNG NGAY
// lên layer và thấy kết quả realtime trên canvas (không modal).
function assess() {
  const panel = $('panelQuality');
  const L = activeLayer();
  if (!L || !L.art) { if (panel) panel.hidden = true; return; }
  if (panel) panel.hidden = false;
  const dpi = artworkDPI();
  const badge = $('dpiBadge');
  let cls, label;
  if (dpi >= 300) { cls = 'ok'; label = 'Đạt chuẩn in'; }
  else if (dpi >= 150) { cls = 'warn'; label = 'Nên xử lý thêm'; }
  else { cls = 'bad'; label = 'Không nên in'; }
  badge.className = 'badge ' + cls;
  badge.textContent = label;
  const wCm = L.wCm, hCm = L.wCm / L.art.aspect;
  $('dpiText').textContent =
    `DPI thực tế: ${Math.round(dpi)} (khổ ${fmt(wCm)} × ${fmt(hCm)} cm)`;

  const note = $('qualityNote');
  const box = $('qualityActions');
  box.innerHTML = '';
  const mkBtn = (txt, rec, fn) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'btn' + (rec ? ' primary' : '');
    b.textContent = txt;
    if (fn) b.onclick = fn;
    return b;
  };

  if (dpi >= 300) {
    // Đạt chuẩn: đề xuất mờ đi (disabled)
    note.textContent = 'Đã đạt 300dpi — không cần xử lý thêm.';
    [['Chuyển vector', btnVector], ['Phóng nét 2×', () => btnUpscale(2)],
     ['Phóng nét 4×', () => btnUpscale(4)]].forEach(([txt]) => {
      const b = mkBtn(txt, false, null);
      b.disabled = true;
      b.title = 'Đã đạt chuẩn in — không cần xử lý thêm';
      box.appendChild(b);
    });
  } else {
    // Chưa đạt: hiện đề xuất rõ, bấm là áp dụng ngay (realtime)
    const isFlat = L.art.typeLabel.indexOf('Hình phẳng') === 0;
    if (isFlat) {
      note.textContent = `Hình phẳng ít màu (${L.art.colorCount} màu) — chuyển vector cho nét ở mọi khổ in.`;
      box.appendChild(mkBtn('Chuyển vector', true, btnVector));
      box.appendChild(mkBtn('Phóng nét 2×', false, () => btnUpscale(2)));
      box.appendChild(mkBtn('Phóng nét 4×', false, () => btnUpscale(4)));
    } else {
      note.textContent = 'Ảnh phức tạp — vector sẽ méo hình, nên phóng nét để tăng mật độ điểm ảnh.';
      box.appendChild(mkBtn('Phóng nét 4×', true, () => btnUpscale(4)));
      box.appendChild(mkBtn('Phóng nét 2×', false, () => btnUpscale(2)));
      box.appendChild(mkBtn('Chuyển vector', false, btnVector));
    }
  }
}

// ---------- Modal so sánh trước/sau ở 100% + zoom ----------
let cmpSt = null;

function openCompare(beforeCv, afterCv, title, note, onApply) {
  cmpSt = { before: beforeCv, after: afterCv, onApply, zoom: 1 };
  $('cmpTitle').textContent = title;
  $('cmpNote').textContent = note || '';
  document.querySelectorAll('.cmp-zoom').forEach((b) => {
    b.classList.toggle('on', b.dataset.z === '1');
    b.onclick = () => {
      document.querySelectorAll('.cmp-zoom').forEach((x) => x.classList.remove('on'));
      b.classList.add('on');
      cmpSt.zoom = Number(b.dataset.z);
      drawCompare();
    };
  });
  $('modalCompare').hidden = false;
  drawCompare();
}

function drawCompare() {
  const z = cmpSt.zoom;
  [['cmpBefore', cmpSt.before], ['cmpAfter', cmpSt.after]].forEach(([id, cv]) => {
    const c = $(id);
    const zeff = Math.min(z, 6000 / Math.max(cv.width, cv.height)); // tránh canvas quá lớn
    c.width = Math.max(1, Math.round(cv.width * zeff));
    c.height = Math.max(1, Math.round(cv.height * zeff));
    const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(cv, 0, 0, c.width, c.height);
  });
}

// ---------- Chuyển vector: contour tracing THẬT ra SVG path ----------
// Không phải posterize giả vector: lượng tử màu -> mask từng lớp ->
// marching squares tìm biên -> nối thành đường bao -> đơn giản hóa -> path SVG.
function btnVector() {
  if (!needArt()) return;
  toast('Đang tracing vector...');
  setTimeout(() => {
    try {
      const { svg, layers, skippedWhite } = traceArtwork(activeArt().raster, 8);
      rasterizeSVG(svg, 1600).then((raster) => {
        // Áp dụng TRỰC TIẾP lên layer — thấy kết quả ngay trên canvas (realtime)
        const a = activeArt();
        a.raster = raster;
        a.svgText = svg;   // giữ vector thật để xuất file in SVG
        a.kind = 'vector';
        a.w = raster.width; a.h = raster.height; // tỉ lệ giữ nguyên
        a.colorCount = layers;
        afterProcess(`Đã chuyển vector (${layers} lớp path${skippedWhite ? ', đã bỏ nền trắng' : ''}).`);
      }).catch(() => toast('Không vẽ được vector ra ảnh xem trước.'));
    } catch (e) {
      console.error(e);
      toast(e.message === 'ONLYWHITE'
        ? 'Artwork chỉ có màu trắng — không có gì để tracing.'
        : 'Tracing thất bại với file này. Hãy thử Phóng nét.');
    }
  }, 30);
}

function traceArtwork(srcCanvas, maxColors = 8) {
  // Thu nhỏ để tracing nhanh (900px giữ nét hơn 420px);
  // path scale về tọa độ output TRƯỚC rồi mới simplify ở tọa độ output.
  const MAXS = 900;
  const sc = Math.min(1, MAXS / Math.max(srcCanvas.width, srcCanvas.height));
  const tw = Math.max(2, Math.round(srcCanvas.width * sc));
  const th = Math.max(2, Math.round(srcCanvas.height * sc));
  const t = document.createElement('canvas');
  t.width = tw; t.height = th;
  const ctx = t.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(srcCanvas, 0, 0, tw, th);
  const id = ctx.getImageData(0, 0, tw, th), d = id.data, n = tw * th;

  // 1) Lượng tử màu: gom theo 4 bit/kênh, giữ maxColors màu phổ biến nhất
  const freq = new Map();
  for (let i = 0; i < n; i++) {
    if (d[i * 4 + 3] < 128) continue;
    const q = ((d[i * 4] >> 4) << 8) | ((d[i * 4 + 1] >> 4) << 4) | (d[i * 4 + 2] >> 4);
    freq.set(q, (freq.get(q) || 0) + 1);
  }
  let palette = [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxColors)
    .map(([q]) => [((q >> 8) & 15) * 16 + 8, ((q >> 4) & 15) * 16 + 8, (q & 15) * 16 + 8]);
  if (!palette.length) throw new Error('EMPTY');

  // Bỏ lớp trắng tinh (nền) để file vector được nền trong suốt
  let skippedWhite = 0;
  palette = palette.filter((c) => {
    const white = c[0] >= 245 && c[1] >= 245 && c[2] >= 245;
    if (white) skippedWhite++;
    return !white;
  });
  if (!palette.length) throw new Error('ONLYWHITE');

  // 2) Gán mỗi pixel vào màu palette gần nhất (khoảng cách Euclid)
  const labels = new Uint8Array(n).fill(255);
  for (let i = 0; i < n; i++) {
    if (d[i * 4 + 3] < 128) continue;
    const r = d[i * 4], g = d[i * 4 + 1], b = d[i * 4 + 2];
    let bi = 0, bd = Infinity;
    for (let k = 0; k < palette.length; k++) {
      const p = palette[k];
      const dr = r - p[0], dg = g - p[1], db = b - p[2];
      const dist = dr * dr + dg * dg + db * db;
      if (dist < bd) { bd = dist; bi = k; }
    }
    labels[i] = bi;
  }

  // 3) Mỗi lớp màu: mask nhị phân -> marching squares -> nối đoạn -> gọn path.
  //    FIX nét SVG: gộp MỌI contour cùng màu thành MỘT <path> duy nhất với
  //    fill-rule="evenodd" để lỗ hổng (counter của chữ a/e/o) không bị tô lấp.
  //    Scale về tọa độ output TRƯỚC, rồi simplify với tolerance 0.7 ở tọa độ
  //    output (thay vì simplify ở tọa độ thu nhỏ rồi phóng lên làm mất nét).
  const kx = srcCanvas.width / tw, ky = srcCanvas.height / th;
  let paths = '';
  palette.forEach((col, li) => {
    const mask = new Uint8Array(n);
    for (let i = 0; i < n; i++) mask[i] = labels[i] === li ? 1 : 0;
    const segs = marchingSquares(mask, tw, th);
    if (!segs.length) return;
    const hex = '#' + col.map((v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('');
    let d = '';
    chainSegments(segs).forEach((pts) => {
      if (pts.length < 2) return;
      const closed = isClosed(pts);
      const sp = simplify(pts.map(([x, y]) => [x * kx, y * ky]), 0.7);
      d += `M${sp[0][0].toFixed(1)} ${sp[0][1].toFixed(1)}`;
      for (let k = 1; k < sp.length; k++) {
        d += `L${sp[k][0].toFixed(1)} ${sp[k][1].toFixed(1)}`;
      }
      if (closed) d += 'Z';
    });
    if (d) paths += `<path d="${d}" fill="${hex}" fill-rule="evenodd"/>`;
  });

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${srcCanvas.width} ${srcCanvas.height}" ` +
    `width="${srcCanvas.width}" height="${srcCanvas.height}">${paths}</svg>`;
  return { svg, layers: palette.length, skippedWhite };
}

function isClosed(pts) {
  const a = pts[0], b = pts[pts.length - 1];
  return Math.abs(a[0] - b[0]) < 0.01 && Math.abs(a[1] - b[1]) < 0.01;
}

// Marching squares: tìm biên của vùng mask=1, trả về các đoạn thẳng.
// Ô (cx,cy) xét 4 góc a=TL b=TR c=BR d=BL; đoạn nối trung điểm các cạnh.
function marchingSquares(mask, w, h) {
  const segs = [];
  for (let cy = 0; cy < h - 1; cy++) {
    for (let cx = 0; cx < w - 1; cx++) {
      const a = mask[cy * w + cx], b = mask[cy * w + cx + 1];
      const c = mask[(cy + 1) * w + cx + 1], d = mask[(cy + 1) * w + cx];
      const code = a * 8 + b * 4 + c * 2 + d;
      if (code === 0 || code === 15) continue;
      const T = [cx + 0.5, cy], R = [cx + 1, cy + 0.5];
      const B = [cx + 0.5, cy + 1], L = [cx, cy + 0.5];
      const add = (p, q) => segs.push([p[0], p[1], q[0], q[1]]);
      switch (code) {
        case 1: case 14: add(L, B); break;
        case 2: case 13: add(B, R); break;
        case 3: case 12: add(L, R); break;
        case 4: case 11: add(T, R); break;
        case 6: case 9:  add(T, B); break;
        case 7: case 8:  add(T, L); break;
        case 5:  add(T, L); add(B, R); break;
        case 10: add(T, R); add(L, B); break;
      }
    }
  }
  return segs;
}

// Nối các đoạn rời thành đường bao (polyline).
// Nối VÔ HƯỚNG (không phụ thuộc hướng đoạn marching squares): mỗi đầu mút
// tìm đoạn kề chưa dùng rồi đi tiếp bằng đầu còn lại; xử lý vòng khép kín.
function chainSegments(segs) {
  const key = (x, y) => x.toFixed(1) + ',' + y.toFixed(1);
  const adj = new Map(); // key điểm -> [{seg, other:[x,y]}]
  segs.forEach((s, i) => {
    const k1 = key(s[0], s[1]), k2 = key(s[2], s[3]);
    if (!adj.has(k1)) adj.set(k1, []);
    if (!adj.has(k2)) adj.set(k2, []);
    adj.get(k1).push({ seg: i, other: [s[2], s[3]] });
    adj.get(k2).push({ seg: i, other: [s[0], s[1]] });
  });
  const used = new Uint8Array(segs.length);
  const paths = [];
  for (let i = 0; i < segs.length; i++) {
    if (used[i]) continue;
    used[i] = 1;
    const s = segs[i];
    const startK = key(s[0], s[1]);
    const pts = [[s[0], s[1]], [s[2], s[3]]];
    let curK = key(s[2], s[3]);
    for (;;) { // đi tiếp từ đầu cuối
      const nxt = (adj.get(curK) || []).find((c) => !used[c.seg]);
      if (!nxt) break;
      used[nxt.seg] = 1;
      pts.push(nxt.other);
      curK = key(nxt.other[0], nxt.other[1]);
      if (curK === startK) break; // khép vòng
    }
    curK = startK;
    for (;;) { // đi ngược từ đầu đầu
      const nxt = (adj.get(curK) || []).find((c) => !used[c.seg]);
      if (!nxt) break;
      used[nxt.seg] = 1;
      pts.unshift(nxt.other);
      curK = key(nxt.other[0], nxt.other[1]);
      if (curK === key(pts[pts.length - 1][0], pts[pts.length - 1][1])) break;
    }
    paths.push(pts);
  }
  return paths;
}

// Đơn giản hóa polyline (Douglas-Peucker, bản lặp để tránh tràn stack)
function simplify(pts, eps) {
  if (pts.length <= 2) return pts;
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  const dist = (p, a, b) => {
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const L2 = dx * dx + dy * dy;
    if (!L2) return Math.hypot(p[0] - a[0], p[1] - a[1]);
    const t = clamp(((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L2, 0, 1);
    return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
  };
  while (stack.length) {
    const [s, e] = stack.pop();
    let dmax = 0, imax = -1;
    for (let i = s + 1; i < e; i++) {
      const dd = dist(pts[i], pts[s], pts[e]);
      if (dd > dmax) { dmax = dd; imax = i; }
    }
    if (dmax > eps) { keep[imax] = 1; stack.push([s, imax], [imax, e]); }
  }
  return pts.filter((_, i) => keep[i]);
}

// ---------- Phóng nét: nội suy canvas 2x/4x (ghi chú rõ: chưa phải AI upscale) ----------
// Áp dụng TRỰC TIẾP lên layer — thấy kết quả ngay trên canvas (realtime).
function btnUpscale(f) {
  if (!needArt()) return;
  const src = activeArt().raster;
  const cv = document.createElement('canvas');
  cv.width = src.width * f; cv.height = src.height * f;
  const ctx = cv.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(src, 0, 0, cv.width, cv.height);
  const a = activeArt();
  a.raster = cv; a.svgText = null; a.kind = 'raster';
  a.w = cv.width; a.h = cv.height; // tỉ lệ giữ nguyên (cùng nhân f)
  afterProcess(`Đã phóng nét ${f}× (nội suy).`);
}

// Cập nhật sau mỗi lần xử lý: đếm lại màu, đánh giá DPI, vẽ lại
function afterProcess(msg) {
  const a = activeArt();
  if (!a) return;
  const an = analyzeArtwork(a.raster);
  if (!a.svgText) a.colorCount = an.colors;
  a.brightness = an.brightness;
  assess(); render(); renderLayerList(); updateSelPanel(); checkWarnings();
  toast(msg);
}

// =====================================================================
// PHẦN 4: Vùng in an toàn, cảnh báo, panel số đo, xuất file, khởi động app
// =====================================================================

// Vùng in an toàn của mockup: lấy exportZone của vị trí "nguc-truoc"
// (mặt trước) và "lung" (mặt sau) trong config; fallback cứng nếu thiếu.
// Layer nên nằm GỌN trong ít nhất 1 trong 2 vùng này.
function safeZones() {
  const ps = (S.cfg && S.cfg.positions) || [];
  const front = ps.find((p) => p.id === 'nguc-truoc');
  const back = ps.find((p) => p.id === 'lung');
  return [
    (front && front.exportZone) || { x0: 0.10, x1: 0.41, y0: 0.25, y1: 0.75 },
    (back && back.exportZone) || { x0: 0.60, x1: 0.90, y0: 0.25, y1: 0.75 },
  ];
}

// Cảnh báo khi layer đang chọn: (1) tràn ra ngoài vùng in an toàn,
// (2) đè lên vùng cấm (cổ áo, nẹp nút trong warnZones của config).
// Gọi sau mỗi lần di chuyển/thu phóng/đổi cỡ.
function checkWarnings() {
  const bar = $('warnBar');
  const L = activeLayer();
  if (!L || !L.art) { bar.hidden = true; return; }
  const W = S.cfg.kichThuocAnh.w, H = S.cfg.kichThuocAnh.h;
  const r = layerPxOf(L);
  const bx0 = r.x / W, by0 = r.y / H;
  const bx1 = (r.x + r.w) / W, by1 = (r.y + r.h) / H;
  const msgs = [];
  // 1) Vùng in an toàn: bbox phải nằm gọn trong ít nhất 1 vùng (trước/sau)
  const TOL = 0.005;
  const inside = safeZones().some((z) =>
    bx0 >= z.x0 - TOL && by0 >= z.y0 - TOL &&
    bx1 <= z.x1 + TOL && by1 <= z.y1 + TOL);
  if (!inside) msgs.push(`Layer “${L.name}” đang tràn ra ngoài vùng in an toàn — nhà in có thể cắt mất hình.`);
  // 2) Vùng cấm: cổ áo / nẹp nút
  (S.cfg.warnZones || []).forEach((wz) => {
    let hit = false;
    if (wz.loai === 'tron') {
      const cx = wz.x * W, cy = wz.y * H, rr = wz.r * Math.min(W, H);
      const nx = clamp(cx, r.x, r.x + r.w), ny = clamp(cy, r.y, r.y + r.h);
      hit = Math.hypot(cx - nx, cy - ny) < rr;
    } else { // chunhat
      hit = !(bx1 < wz.x0 || bx0 > wz.x1 || by1 < wz.y0 || by0 > wz.y1);
    }
    if (hit) msgs.push(`Hình in đè lên vùng “${wz.ten}” — nên dời ra.`);
  });
  bar.hidden = !msgs.length;
  bar.className = 'warnbar' + (msgs.length ? ' danger' : '');
  bar.innerHTML = msgs.map((m) => '• ' + esc(m)).join('<br>');
}

// Panel thông số áo + tỉ lệ px/cm hiện tại
function updateShirtPanel() {
  const a = S.cfg.ao;
  $('shirtInfo').innerHTML =
    `Áo: <b>${esc(a.kieu)}</b>, size ${esc(a.size)} — ` +
    `Ngang ngực <b>${fmt(a.ngangNgucCm)}</b> cm, Dài <b>${fmt(a.daiAoCm)}</b> cm` +
    `<br>Màu áo: <b>${esc(S.shirtColorName)}</b> <span class="muted small">(${esc(S.shirtColor)})</span>` +
    `<br><span class="muted small">Tỉ lệ ảnh: ${fmt(pxPerCm(), 2)} px/cm</span>`;
}

// ---------- Xuất file ----------

// Tên file an toàn: bỏ dấu tiếng Việt, chỉ giữ chữ/số/gạch nối
function cleanName(s, fallback) {
  const t = String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase();
  return t || fallback || 'file';
}
// Lấy viewBox từ SVG, fallback theo kích thước raster
function svgViewBox(svgText, w, h) {
  const m = String(svgText || '').match(/viewBox\s*=\s*["']([^"']+)["']/i);
  return m ? m[1] : `0 0 ${w || 100} ${h || 100}`;
}
// Lấy phần ruột bên trong thẻ <svg>...</svg>
function svgInner(svgText) {
  const m = String(svgText || '').match(/<svg[^>]*>([\s\S]*)<\/svg\s*>/i);
  return m ? m[1] : '';
}

// (a) Xuất mockup PNG full-res: hiện preview + nút tải rõ ràng
function exportMockup() {
  if (!S.layers.some((l) => l.visible && l.art)) { toast('Chưa có layer nào để xuất.'); return; }
  const W = S.cfg.kichThuocAnh.w, H = S.cfg.kichThuocAnh.h;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  composite(cv.getContext('2d'), W, H);
  cv.toBlob((blob) => {
    if (!blob) { toast('Xuất mockup thất bại.'); return; }
    const url = URL.createObjectURL(blob);
    $('previewImg').src = url;
    const dl = $('pvDownload');
    dl.href = url;
    dl.download = `mockup-${S.mockupId}.png`;
    $('modalPreview').hidden = false;
    toast('Đã tạo mockup — bấm “Tải PNG về máy”.');
  }, 'image/png');
}

// (b1) Xuất file in: mỗi layer visible -> 1 file PNG nền trong suốt,
// 300dpi, đúng khổ cm (giữ tỉ lệ gốc). Vẽ phẳng (không warp).
function exportPrintPNG() {
  const layers = S.layers.filter((l) => l.visible && l.art);
  if (!layers.length) { toast('Chưa có layer nào để xuất.'); return; }
  layers.forEach((layer, i) => {
    const wCm = layer.wCm, hCm = wCm / layer.art.aspect;
    const pw = Math.round((wCm / 2.54) * 300);
    const ph = Math.round((hCm / 2.54) * 300);
    const cv = document.createElement('canvas');
    cv.width = pw; cv.height = ph;
    const ctx = cv.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(printRaster(layer), 0, 0, pw, ph);
    const fname = `file-in-${cleanName(layer.name, 'layer' + (i + 1))}-${fmt(wCm)}x${fmt(hCm)}cm-300dpi.png`;
    setTimeout(() => {
      cv.toBlob((b) => { if (b) download(b, fname); }, 'image/png');
    }, i * 800); // giãn cách để trình duyệt không chặn tải nhiều file
  });
  toast(`Đang xuất ${layers.length} file in PNG 300dpi...`);
}

// (b2) Xuất file in SVG — mỗi layer visible có vector -> 1 file SVG đúng khổ cm
function exportPrintSVG() {
  const layers = S.layers.filter((l) => l.visible && l.art && l.art.svgText);
  if (!layers.length) {
    toast('Chưa có layer vector nào. Hãy bấm “Chuyển vector” hoặc tải file SVG lên trước.');
    return;
  }
  layers.forEach((layer, i) => {
    const wCm = layer.wCm, hCm = wCm / layer.art.aspect;
    const vb = svgViewBox(layer.art.svgText, layer.art.w, layer.art.h);
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" ` +
      `width="${fmt(wCm)}cm" height="${fmt(hCm)}cm">` +
      `${svgInner(svgForPrint(layer.art.svgText))}</svg>`;
    const fname = `file-in-${cleanName(layer.name, 'layer' + (i + 1))}.svg`;
    setTimeout(() => {
      download(new Blob([svg], { type: 'image/svg+xml' }), fname);
    }, i * 800);
  });
  toast(`Đang xuất ${layers.length} file in SVG...`);
}

// (c) Xuất phiếu kỹ thuật .txt gửi nhà in (liệt kê từng layer)
function exportSpec() {
  const layers = S.layers.filter((l) => l.art);
  if (!layers.length) { toast('Chưa có layer nào để xuất.'); return; }
  const a = S.cfg.ao;
  const lines = [
    'PHIEU KY THUAT IN AO',
    '=====================',
    `Khach hang: ${$('inpCust').value || '—'}`,
    `Ma don: ${$('inpCode').value || '—'}`,
    `Mockup: ${S.cfg.ten} (${a.kieu}, size ${a.size})`,
    `Mau ao: ${S.shirtColorName} (${S.shirtColor})`,
    `So layer: ${layers.length}`,
  ];
  layers.forEach((l, i) => {
    const wCm = l.wCm, hCm = wCm / l.art.aspect;
    const dpiW = l.art.w / (wCm / 2.54), dpiH = l.art.h / (hCm / 2.54);
    lines.push(
      `--- Layer ${i + 1}: ${l.name}${l.visible ? '' : ' (dang an)'}`,
      `  Kich thuoc: ${fmt(wCm)} x ${fmt(hCm)} cm`,
      `  DPI thuc te: ${Math.round(Math.min(dpiW, dpiH))}`,
      `  So mau: ${l.art.colorCount}${l.art.svgText ? ' (da vector hoa)' : ''}`,
    );
  });
  lines.push(
    `Mau file in: ${S.printColor.mode === 'single' ? S.printColor.color + ' (in 1 mau)' : 'Giu nguyen mau goc'}`,
    `Phuong phap in: ${$('selMethod').value}`,
    `Ngay chot: ${$('inpDate').value || '—'}`,
    `Ti le px/cm hieu chuan: ${fmt(pxPerCm(), 2)}`,
  );
  const code = ($('inpCode').value || 'don').replace(/[^\w-]+/g, '-');
  download(new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' }),
    `phieu-ky-thuat-${code}.txt`);
  toast('Đã xuất phiếu kỹ thuật.');
}

// ---------- Xóa layer ----------
// Xóa layer theo id; nếu là layer đang chọn thì chọn layer trên cùng còn lại.
function deleteLayer(id) {
  const idx = S.layers.findIndex((l) => l.id === id);
  if (idx < 0) return;
  const [rm] = S.layers.splice(idx, 1);
  if (S.activeLayerId === id) {
    S.activeLayerId = S.layers.length ? S.layers[S.layers.length - 1].id : null;
  }
  syncSizeInputs(); syncProcVisibility();
  assess(); render(); renderLayerList(); updateSelPanel(); checkWarnings();
  toast(`Đã xóa layer “${rm.name}”.`);
}
// Cập nhật panel "Layer đang chọn": tên + kích thước in + thông số file.
function updateSelPanel() {
  const el = $('selInfo');
  if (!el) return;
  const L = activeLayer();
  if (!L || !L.art) {
    el.innerHTML = '<span class="muted">Chưa chọn layer nào. Tải file hoặc bấm vào hình trên canvas.</span>';
    return;
  }
  const wCm = L.wCm, hCm = L.wCm / L.art.aspect;
  const colInfo = S.printColor.mode === 'single'
    ? ` · in 1 màu <b>${esc(S.printColor.color)}</b>`
    : '';
  el.innerHTML =
    `<b>${esc(L.name)}</b> — <b>${fmt(wCm)} × ${fmt(hCm)} cm</b><br>` +
    `<span class="muted small">${L.art.w} × ${L.art.h} px · DPI thực tế ` +
    `<b>${Math.round(artworkDPI())}</b>` +
    (L.art.svgText ? ' · đã vector hóa' : '') + colInfo + '</span>';
}

// Ẩn panel "Chất lượng & Xử lý" khi chưa có layer nào đang chọn (đỡ rối)
function syncProcVisibility() {
  const p = $('panelQuality');
  if (p) p.hidden = !activeLayer();
}

// ---------- Panel Layers (kiểu Photoshop) ----------
// Vẽ danh sách layers: thumbnail + tên + nút ẩn/hiện + lên/xuống + xóa.
// Hiển thị từ layer TRÊN CÙNG xuống dưới (ngược thứ tự mảng).
function renderLayerList() {
  const el = $('layerList');
  if (!el) return;
  el.innerHTML = '';
  if (!S.layers.length) {
    el.innerHTML = '<div class="muted small">Chưa có layer nào.<br>Bấm “Tải file thiết kế” để thêm.</div>';
    return;
  }
  for (let i = S.layers.length - 1; i >= 0; i--) {
    const layer = S.layers[i];
    const row = document.createElement('div');
    row.className = 'layer-row' + (layer.id === S.activeLayerId ? ' active' : '');
    row.dataset.id = layer.id;
    const thumb = document.createElement('canvas');
    thumb.className = 'layer-thumb'; thumb.width = 44; thumb.height = 44;
    const nm = document.createElement('span');
    nm.className = 'layer-name'; nm.textContent = layer.name; nm.title = layer.name;
    const mkBtn = (cls, title, txt) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'icon-btn ' + cls; b.title = title; b.textContent = txt;
      b.dataset.id = layer.id;
      return b;
    };
    const bUp = mkBtn('ly-up', 'Đưa lên trên', '↑');
    const bDn = mkBtn('ly-down', 'Đưa xuống dưới', '↓');
    const bEye = mkBtn('ly-eye', layer.visible ? 'Ẩn layer' : 'Hiện layer', layer.visible ? '👁' : '🚫');
    if (!layer.visible) row.classList.add('hidden-layer');
    const bDel = mkBtn('ly-del', 'Xóa layer', '×');
    row.append(thumb, nm, bUp, bDn, bEye, bDel);
    // Vẽ thumbnail từ raster (giữ tỉ lệ, căn giữa)
    try {
      const t = thumb.getContext('2d');
      t.clearRect(0, 0, 44, 44);
      const sc = Math.min(44 / layer.art.raster.width, 44 / layer.art.raster.height);
      const dw = layer.art.raster.width * sc, dh = layer.art.raster.height * sc;
      t.drawImage(layer.art.raster, (44 - dw) / 2, (44 - dh) / 2, dw, dh);
    } catch (e) { /* bỏ qua */ }
    // Bấm vào dòng (trừ các nút) -> chọn layer
    row.addEventListener('click', (e) => {
      if (e.target.closest('.icon-btn')) return;
      setActiveLayer(layer.id);
    });
    el.appendChild(row);
  }
}

// Xử lý click trên các nút của từng dòng layer (dùng event delegation)
function initLayerList() {
  $('layerList').addEventListener('click', (e) => {
    const b = e.target.closest('.icon-btn');
    if (!b) return;
    const id = b.dataset.id;
    const idx = S.layers.findIndex((l) => l.id === id);
    if (idx < 0) return;
    if (b.classList.contains('ly-eye')) {
      S.layers[idx].visible = !S.layers[idx].visible;
      render(); renderLayerList();
    } else if (b.classList.contains('ly-del')) {
      deleteLayer(id);
    } else if (b.classList.contains('ly-up') && idx < S.layers.length - 1) {
      // lên trên = đổi chỗ với phần tử đứng sau (vẽ sau = nằm trên)
      [S.layers[idx], S.layers[idx + 1]] = [S.layers[idx + 1], S.layers[idx]];
      render(); renderLayerList();
    } else if (b.classList.contains('ly-down') && idx > 0) {
      [S.layers[idx], S.layers[idx - 1]] = [S.layers[idx - 1], S.layers[idx]];
      render(); renderLayerList();
    }
  });
}

// Chọn layer đang thao tác + refresh UI liên quan
function setActiveLayer(id, silent) {
  S.activeLayerId = id;
  syncSizeInputs(); syncProcVisibility();
  assess(); render(); renderLayerList(); updateSelPanel(); checkWarnings();
  updateSelPanel();
  if (!silent) {
    const L = activeLayer();
    if (L) toast(`Đang chọn layer “${L.name}”.`);
  }
}

// =====================================================================
// PHẦN 5: Lưu / mở lại file làm việc (localStorage, theo tên khách + mã đơn)
// =====================================================================
const LS_KEY = 'mockupStudioProjects';

function lsAll() {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '{}'); }
  catch (e) { return {}; }
}
function lsPut(all) {
  localStorage.setItem(LS_KEY, JSON.stringify(all));
}
function projectFileName() {
  return `${cleanName($('inpCust').value, 'khach')}-${cleanName($('inpCode').value, 'don')}`;
}

// Lưu project: toàn bộ layers (artwork dạng PNG dataURL + vị trí/cỡ) theo tên khách + mã đơn
function saveProject() {
  const layers = [];
  for (const l of S.layers) {
    if (!l.art) continue;
    let artDataURL = null;
    try {
      artDataURL = l.art.raster.toDataURL('image/png');
    } catch (e) {
      toast('File quá lớn, không lưu được ảnh. Hãy giảm phóng nét rồi lưu lại.', 4500);
      return;
    }
    layers.push({
      id: l.id, name: l.name, visible: l.visible !== false,
      artDataURL,
      svgText: l.art.svgText || null,
      w: l.art.w, h: l.art.h, aspect: l.art.aspect,
      kind: l.art.kind,
      colorCount: l.art.colorCount, typeLabel: l.art.typeLabel,
      brightness: (typeof l.art.brightness === 'number') ? l.art.brightness : 1,
      x: l.x, y: l.y, wCm: l.wCm,
    });
  }
  if (!layers.length) { toast('Chưa có layer nào để lưu.'); return; }
  const proj = {
    tenKhach: $('inpCust').value || '', maDon: $('inpCode').value || '',
    ngay: $('inpDate').value || '', mockupId: S.mockupId,
    phuongPhapIn: $('selMethod').value, chestCm: S.cfg.ao.ngangNgucCm,
    activeLayerId: S.activeLayerId, layers,
    printColor: { ...S.printColor },
    shirtColor: S.shirtColor, shirtColorName: S.shirtColorName,
    savedAt: new Date().toISOString(),
  };
  const name = projectFileName();
  try {
    const all = lsAll();
    const existed = !!all[name];
    all[name] = proj;
    lsPut(all);
    renderSavedList();
    toast(existed ? `Đã ghi đè file "${name}".` : `Đã lưu file "${name}".`);
  } catch (e) {
    toast('Không lưu được (bộ nhớ trình duyệt đầy?).', 4000);
  }
}

// Mở lại project: khôi phục mockup + toàn bộ placements + artwork
async function openProject(name) {
  const proj = lsAll()[name];
  if (!proj) { toast('Không tìm thấy file.'); return; }
  toast('Đang mở file...');
  try {
    if (proj.mockupId !== S.mockupId) {
      await loadMockup(proj.mockupId);
      $('selMockup').value = proj.mockupId;
    } else {
      S.layers = [];
      S.activeLayerId = null;
    }
    // Tương thích file cũ (placements theo vị trí) -> chuyển thành layers
    const oldPlacements = proj.placements || [];
    for (const sp of oldPlacements) {
      const raster = await loadImage(sp.artDataURL);
      S.layers.push({
        id: 'L' + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36),
        name: (sp.name || 'layer') + '',
        visible: true,
        art: {
          raster, svgText: sp.svgText || null,
          w: sp.w, h: sp.h, aspect: sp.aspect, name: sp.name,
          kind: sp.kind, colorCount: sp.colorCount, typeLabel: sp.typeLabel,
        },
        x: sp.design ? sp.design.cx : 0.25,
        y: sp.design ? sp.design.cy : 0.47,
        wCm: sp.design ? sp.design.wCm : 28,
      });
    }
    for (const sl of proj.layers || []) {
      const raster = await loadImage(sl.artDataURL);
      S.layers.push({
        id: sl.id || ('L' + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36)),
        name: sl.name || 'layer',
        visible: sl.visible !== false,
        art: {
          raster, svgText: sl.svgText || null,
          w: sl.w, h: sl.h, aspect: sl.aspect, name: sl.name,
          kind: sl.kind, colorCount: sl.colorCount, typeLabel: sl.typeLabel,
          brightness: (typeof sl.brightness === 'number') ? sl.brightness : 1,
        },
        x: sl.x, y: sl.y, wCm: sl.wCm,
      });
    }
    S.activeLayerId = (proj.activeLayerId && S.layers.some((l) => l.id === proj.activeLayerId))
      ? proj.activeLayerId
      : (S.layers.length ? S.layers[S.layers.length - 1].id : null);
    $('inpCust').value = proj.tenKhach || '';
    $('inpCode').value = proj.maDon || '';
    if (proj.ngay) $('inpDate').value = proj.ngay;
    if (proj.phuongPhapIn) $('selMethod').value = proj.phuongPhapIn;
    if (proj.chestCm > 0) {
      S.cfg.ao.ngangNgucCm = proj.chestCm;
      $('inpChest').value = proj.chestCm;
    }
    if (proj.printColor && proj.printColor.mode) {
      S.printColor = { mode: proj.printColor.mode, color: proj.printColor.color || '#1a1a1a' };
      syncColorUI();
    }
    if (proj.shirtColor) {
      S.shirtColor = proj.shirtColor;
      S.shirtColorName = proj.shirtColorName || proj.shirtColor;
      syncShirtColorUI();
    }
    updateSelPanel();
    syncSizeInputs(); syncProcVisibility(); assess();
    render(); renderLayerList(); updateShirtPanel(); updateSelPanel(); checkWarnings();
    toast(`Đã mở file "${name}".`);
  } catch (e) {
    console.error(e);
    toast('Mở file thất bại (dữ liệu lưu có thể đã hỏng).', 4000);
  }
}

// Danh sách file đã lưu: mở lại / xóa
function renderSavedList() {
  const el = $('savedList');
  const all = lsAll();
  const names = Object.keys(all).sort((a, b) =>
    String(all[b].savedAt || '').localeCompare(String(all[a].savedAt || '')));
  if (!names.length) {
    el.innerHTML = '<div class="muted small">Chưa lưu file nào.</div>';
    return;
  }
  el.innerHTML = '';
  names.forEach((name) => {
    const p = all[name];
    const nPl = (p.layers || p.placements || []).length;
    const d = document.createElement('div');
    d.className = 'saved-item';
    const day = String(p.savedAt || '').slice(0, 10);
    d.innerHTML =
      `<div><b>${esc(name)}</b></div>` +
      `<div class="meta">${esc(p.mockupId || '')} · ${nPl} layer · ${esc(day)}</div>` +
      `<div class="acts"></div>`;
    const bO = document.createElement('button');
    bO.className = 'btn small primary'; bO.textContent = 'Mở lại';
    bO.onclick = () => openProject(name);
    const bD = document.createElement('button');
    bD.className = 'btn small'; bD.textContent = 'Xóa';
    bD.onclick = () => {
      if (confirm(`Xóa file "${name}"?`)) {
        const a2 = lsAll(); delete a2[name]; lsPut(a2);
        renderSavedList(); toast('Đã xóa file.');
      }
    };
    d.querySelector('.acts').append(bO, bD);
    el.appendChild(d);
  });
}

// ---------- Khởi động ----------
async function init() {
  const sel = $('selMockup');
  MOCKUPS.forEach((m) => {
    const o = document.createElement('option');
    o.value = m.id; o.textContent = m.ten;
    sel.appendChild(o);
  });
  sel.onchange = () => loadMockup(sel.value);

  $('inpW').addEventListener('change', () => {
    if (!activeLayer()) return;
    const v = parseFloat($('inpW').value);
    if (v > 0) setPrintWidth(v);
    render(); updateSelPanel(); checkWarnings(); assess();
  });
  $('inpH').addEventListener('change', () => {
    if (!activeLayer()) return;
    const v = parseFloat($('inpH').value);
    if (v > 0) setPrintHeight(v);
    render(); updateSelPanel(); checkWarnings(); assess();
  });

  // Quy tắc cứng: tỉ lệ luôn khóa — bấm vào chỉ để xem giải thích
  $('btnLock').onclick = () =>
    toast('Tỉ lệ luôn được khóa để không méo hình — mọi thao tác đều giữ đúng tỉ lệ gốc.');

  $('inpChest').addEventListener('change', () => {
    const v = parseFloat($('inpChest').value);
    if (v > 0 && S.cfg) {
      S.cfg.ao.ngangNgucCm = v; // hiệu chuẩn lại -> pxPerCm() tự tính lại
      updateShirtPanel();
      render(); updateSelPanel(); checkWarnings(); assess();
    }
  });

  // Nút xử lý ảnh (khử nền trắng / crop — giữ modal so sánh/cắt)
  // Vector & phóng nét do assess() tạo nút động trong #qualityActions
  $('btnWhite').onclick = btnWhite;
  $('btnCrop').onclick = openCrop;
  $('cropCancel').onclick = () => { $('modalCrop').hidden = true; };
  $('cropApply').onclick = applyCrop;

  // Nút xuất file
  $('btnExpMockup').onclick = exportMockup;
  $('btnExpPrint').onclick = exportPrintPNG;
  $('btnExpSVG').onclick = exportPrintSVG;
  $('btnExpSpec').onclick = exportSpec;

  // (Đã bỏ nút "Xóa hình in" — xóa layer bằng nút × trên mỗi dòng trong panel Layers)

  // Nút Auto: đưa layer đang chọn về giữa ngực trước với cỡ in mặc định
  // (giữ đúng tỉ lệ gốc)
  $('btnAutoFitNow').onclick = () => {
    const L = activeLayer();
    if (!L || !L.art) { toast('Chưa có layer nào để căn.'); return; }
    const dp = defaultLayerPlacement();
    L.x = dp.x; L.y = dp.y; L.wCm = dp.wCm;
    syncSizeInputs();
    render(); updateSelPanel(); checkWarnings(); assess();
    toast('Đã đưa layer về giữa ngực trước.');
  };

  // Tùy chọn màu file in: áp dụng cho mockup + mọi file xuất
  document.querySelectorAll('input[name="colorMode"]').forEach((r) => {
    r.addEventListener('change', () => {
      S.printColor.mode = document.querySelector('input[name="colorMode"]:checked').value;
      $('colorRow').hidden = S.printColor.mode !== 'single';
      render(); updateSelPanel();
      toast(S.printColor.mode === 'single'
        ? 'Đã bật in 1 màu — mockup và mọi file xuất sẽ dùng màu đã chọn.'
        : 'Đã về chế độ giữ nguyên màu gốc.');
    });
  });
  $('inpPrintColor').addEventListener('input', (e) => {
    S.printColor.color = e.target.value;
    syncSwatches();
    render();
  });
  $('swatches').addEventListener('click', (e) => {
    const b = e.target.closest('.sw');
    if (!b) return;
    S.printColor.color = b.dataset.c;
    $('inpPrintColor').value = b.dataset.c;
    syncSwatches();
    render();
  });
  syncColorUI();

  // Chọn màu áo: đổi swatch -> nhuộm lại mockup (có toast vì tính toán 1-2 giây)
  $('shirtSwatches').addEventListener('click', (e) => {
    const b = e.target.closest('.sw');
    if (!b || b.dataset.c === S.shirtColor) return;
    toast('Đang đổi màu áo...');
    setTimeout(() => {
      S.shirtColor = b.dataset.c;
      S.shirtColorName = b.dataset.n || b.dataset.c;
      syncShirtColorUI();
      render(); updateShirtPanel();
    }, 30);
  });
  syncShirtColorUI();

  // Toggle hiện/ẩn lớp số đo
  $('chkMeasure').onchange = () => render();

  // Panel Layers kiểu Photoshop
  initLayerList();
  renderLayerList();

  // Lưu / mở file làm việc
  $('btnSave').onclick = saveProject;
  renderSavedList();

  // Modal so sánh / preview
  $('cmpApply').onclick = () => {
    $('modalCompare').hidden = true;
    if (cmpSt) cmpSt.onApply();
  };
  $('cmpCancel').onclick = () => { $('modalCompare').hidden = true; };
  $('pvClose').onclick = () => { $('modalPreview').hidden = true; };

  $('inpDate').value = new Date().toISOString().slice(0, 10);
  window.addEventListener('resize', fitStage);

  await loadMockup('tshirt');
  sel.value = 'tshirt';
}

init();
