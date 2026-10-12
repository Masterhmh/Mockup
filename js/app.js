'use strict';
/* =====================================================================
   Studio Mockup In Áo — chạy hoàn toàn phía trình duyệt, không backend.
   Kiến trúc config-driven: mỗi mockup = 1 ảnh thật + 1 file JSON trong
   mockups/. Thêm mockup mới chỉ cần thêm ảnh + JSON, không sửa code.
   ===================================================================== */

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
  art: null,            // {raster, svgText, w, h, aspect, name, kind, colorCount, typeLabel}
  design: null,         // {cx, cy (tỉ lệ 0-1), wCm, hCm}
  posId: 'nguc-truoc',
  ratioLocked: true,    // QUY TẮC CỨNG: luôn khóa tỉ lệ gốc
  drag: null,
  view: { dw: 0, dh: 0, dpr: 1 }, // ánh xạ ảnh gốc -> css px
};

const MOCKUPS = [
  { id: 'tshirt', file: 'mockups/tshirt.json', ten: 'Áo cổ tròn trắng' },
  { id: 'polo',   file: 'mockups/polo.json',   ten: 'Áo polo trắng' },
];

// Config dự phòng khi mở file:// trực tiếp (fetch JSON bị chặn CORS)
const FALLBACK_CFG = {
  tshirt: {"ao":{"daiAoCm":72,"kieu":"Áo cổ tròn","ngangNgucCm":52,"ngangNgucPx":1260,"size":"L"},"fileAnh":"Tshirt.jpg","kichThuocAnh":{"h":3242,"w":4864},"positions":[{"center":{"x":0.294,"y":0.44},"id":"nguc-truoc","khoInMacDinhCm":28,"ten":"Ngực trước","zone":{"x0":0.17,"x1":0.42,"y0":0.33,"y1":0.58}},{"center":{"x":0.215,"y":0.36},"id":"logo-nguc-trai","khoInMacDinhCm":10,"ten":"Logo ngực trái","zone":{"x0":0.16,"x1":0.27,"y0":0.3,"y1":0.42}},{"center":{"x":0.72,"y":0.43},"id":"lung","khoInMacDinhCm":30,"ten":"Lưng","zone":{"x0":0.6,"x1":0.84,"y0":0.31,"y1":0.58}}],"ten":"Áo cổ tròn trắng","warnZones":[{"loai":"tron","r":0.05,"ten":"Cổ trước","x":0.294,"y":0.215},{"loai":"tron","r":0.045,"ten":"Cổ sau","x":0.72,"y":0.2}]},
  polo: {"ao":{"daiAoCm":72,"kieu":"Áo polo","ngangNgucCm":52,"ngangNgucPx":1040,"size":"L"},"fileAnh":"Polo.jpg","kichThuocAnh":{"h":3000,"w":4000},"positions":[{"center":{"x":0.285,"y":0.47},"id":"nguc-truoc","khoInMacDinhCm":26,"ten":"Ngực trước","zone":{"x0":0.16,"x1":0.41,"y0":0.37,"y1":0.6}},{"center":{"x":0.205,"y":0.375},"id":"logo-nguc-trai","khoInMacDinhCm":9,"ten":"Logo ngực trái","zone":{"x0":0.15,"x1":0.26,"y0":0.32,"y1":0.43}},{"center":{"x":0.715,"y":0.42},"id":"lung","khoInMacDinhCm":28,"ten":"Lưng","zone":{"x0":0.59,"x1":0.84,"y0":0.3,"y1":0.56}}],"ten":"Áo polo trắng","warnZones":[{"loai":"chunhat","ten":"Nẹp nút","x0":0.262,"x1":0.308,"y0":0.2,"y1":0.345},{"loai":"tron","r":0.045,"ten":"Cổ trước","x":0.285,"y":0.2},{"loai":"tron","r":0.04,"ten":"Cổ sau","x":0.715,"y":0.19}]}
};

// ---------- Tải mockup ----------
// Tải config JSON + ảnh áo thật. Lỗi fetch (mở file://) thì dùng config dự phòng.
async function loadMockup(id) {
  S.mockupId = id;
  const meta = MOCKUPS.find((m) => m.id === id);
  let cfg = null;
  try {
    cfg = await (await fetch(meta.file)).json();
  } catch (e) {
    cfg = FALLBACK_CFG[id]; // mở trực tiếp file:// 
  }
  S.cfg = cfg;
  S.baseImg = await loadImage(cfg.fileAnh);
  S.off.width = cfg.kichThuocAnh.w;
  S.off.height = cfg.kichThuocAnh.h;

  const sel = $('selPos');
  sel.innerHTML = '';
  cfg.positions.forEach((p) => {
    const o = document.createElement('option');
    o.value = p.id; o.textContent = p.ten;
    sel.appendChild(o);
  });
  S.posId = cfg.positions[0].id;
  sel.value = S.posId;
  $('inpChest').value = cfg.ao.ngangNgucCm;

  resetDesign();
  fitStage();
  updateShirtPanel(); updatePrintPanel(); checkWarnings(); assess();
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

function curPos() {
  return S.cfg.positions.find((p) => p.id === S.posId);
}

// Đặt lại hình in về mặc định của vị trí đang chọn (giữ đúng tỉ lệ artwork)
function resetDesign() {
  const p = curPos();
  const wCm = p.khoInMacDinhCm;
  const aspect = S.art ? S.art.aspect : 1;
  S.design = { cx: p.center.x, cy: p.center.y, wCm, hCm: wCm / aspect };
  syncSizeInputs();
}

// Hộp hình in theo px ảnh gốc
function designPx() {
  const W = S.cfg.kichThuocAnh.w, H = S.cfg.kichThuocAnh.h;
  const ppc = pxPerCm();
  const w = S.design.wCm * ppc, h = S.design.hCm * ppc;
  return { x: S.design.cx * W - w / 2, y: S.design.cy * H - h / 2, w, h };
}

// ---------- Render mockup chân thực ----------
// 1) Vẽ ảnh áo thật full-res làm nền.
// 2) Vẽ design (warp nhẹ 24 lát theo sin) bằng multiply alpha 0.93:
//    trên áo trắng, nền trắng artwork tự biến mất, màu hòa vào vải.
// 3) Khôi phục chất vải: clip đúng bbox design, vẽ lại ảnh gốc bằng
//    overlay alpha 0.35 để nếp vải/bóng đổ hiện xuyên qua hình in.
function composite(ctx, W, H) {
  ctx.save();
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  ctx.drawImage(S.baseImg, 0, 0, W, H);

  if (S.art && S.design) {
    const r = designPx();
    const art = S.art.raster;
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

    ctx.globalCompositeOperation = 'multiply';
    ctx.globalAlpha = 0.93;
    ctx.drawImage(tmp, r.x - pad, r.y - pad, tmp.width, tmp.height);

    ctx.save();
    ctx.beginPath();
    ctx.rect(r.x - pad, r.y - pad, tmp.width, tmp.height);
    ctx.clip();
    ctx.globalCompositeOperation = 'overlay';
    ctx.globalAlpha = 0.35;
    ctx.drawImage(S.baseImg, 0, 0, W, H);
    ctx.restore();
  }
  ctx.restore();
}

const stage = $('stage');
const sctx = stage.getContext('2d');

// Vừa canvas hiển thị theo khung (giữ tỉ lệ ảnh)
function fitStage() {
  if (!S.cfg) return;
  const wrap = $('canvasWrap');
  const cw = Math.max(280, wrap.clientWidth);
  const maxH = Math.max(320, Math.floor(window.innerHeight * 0.72));
  const { w: W, h: H } = S.cfg.kichThuocAnh;
  const s = Math.min(cw / W, maxH / H);
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  stage.style.height = Math.floor(H * s) + 'px';
  stage.width = Math.floor(cw * dpr);
  stage.height = Math.floor(H * s * dpr);
  S.view = { dw: cw, dh: H * s, dpr };
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
  $('dropHint').style.display = S.art ? 'none' : 'flex';
}

// Đổi tọa độ px ảnh gốc -> css px trên canvas hiển thị
function toCss(px, py) {
  return [
    (px / S.cfg.kichThuocAnh.w) * S.view.dw,
    (py / S.cfg.kichThuocAnh.h) * S.view.dh,
  ];
}

// Khung chọn + 4 tay cầm góc
function drawSelection() {
  if (!S.art || !S.design) return;
  const r = designPx();
  const [x1, y1] = toCss(r.x, r.y);
  const [x2, y2] = toCss(r.x + r.w, r.y + r.h);
  sctx.save();
  sctx.strokeStyle = '#0e7c5b';
  sctx.lineWidth = 1.5;
  sctx.setLineDash([6, 4]);
  sctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
  sctx.setLineDash([]);
  const HS = 9;
  sctx.fillStyle = '#0e7c5b';
  [[x1, y1], [x2, y1], [x1, y2], [x2, y2]].forEach(([x, y]) => {
    sctx.fillRect(x - HS, y - HS, HS * 2, HS * 2);
  });
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
  if (!S.design) return -1;
  const r = designPx();
  const corners = [[r.x, r.y], [r.x + r.w, r.y], [r.x, r.y + r.h], [r.x + r.w, r.y + r.h]];
  const R = (16 / S.view.dw) * S.cfg.kichThuocAnh.w; // ~16 css px
  for (let i = 0; i < 4; i++) {
    const dx = p.x - corners[i][0], dy = p.y - corners[i][1];
    if (dx * dx + dy * dy <= R * R) return i;
  }
  return -1;
}

stage.addEventListener('pointerdown', (e) => {
  if (!S.art || !S.design) return;
  const p = evtImg(e);
  const r = designPx();
  if (hitHandle(p) >= 0) {
    S.drag = {
      mode: 'scale',
      cx: r.x + r.w / 2, cy: r.y + r.h / 2,
      d0: Math.hypot(p.x - (r.x + r.w / 2), p.y - (r.y + r.h / 2)),
      w0: S.design.wCm,
    };
  } else if (p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h) {
    S.drag = { mode: 'move', ox: p.x - r.x, oy: p.y - r.y };
  } else return;
  stage.setPointerCapture(e.pointerId);
  stage.style.cursor = 'grabbing';
  e.preventDefault();
});

stage.addEventListener('pointermove', (e) => {
  if (!S.drag) return;
  const p = evtImg(e);
  const W = S.cfg.kichThuocAnh.w, H = S.cfg.kichThuocAnh.h;
  if (S.drag.mode === 'move') {
    const r = designPx();
    S.design.cx = clamp((p.x - S.drag.ox + r.w / 2) / W, 0, 1);
    S.design.cy = clamp((p.y - S.drag.oy + r.h / 2) / H, 0, 1);
  } else {
    const d = Math.hypot(p.x - S.drag.cx, p.y - S.drag.cy);
    if (d > 4 && S.drag.d0 > 4) setPrintWidth((S.drag.w0 * d) / S.drag.d0);
  }
  render(); updatePrintPanel(); checkWarnings();
});

const endDrag = () => { S.drag = null; stage.style.cursor = 'grab'; };
stage.addEventListener('pointerup', endDrag);
stage.addEventListener('pointercancel', endDrag);

// ---------- Kích thước in (cm): 2 ô tự đồng bộ, LUÔN giữ tỉ lệ gốc ----------
function setPrintWidth(wCm) {
  wCm = clamp(wCm, 1, 200);
  S.design.wCm = wCm;
  S.design.hCm = wCm / S.art.aspect;
  syncSizeInputs();
}
function setPrintHeight(hCm) {
  hCm = clamp(hCm, 1, 200);
  S.design.hCm = hCm;
  S.design.wCm = hCm * S.art.aspect;
  syncSizeInputs();
}
function syncSizeInputs() {
  if (!S.design) return;
  $('inpW').value = fmt(S.design.wCm);
  $('inpH').value = fmt(S.design.hCm);
  $('lockRatio').textContent = S.art ? 'tỉ lệ ' + ratioText(S.art.aspect) : '—';
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
  if (!S.art) { toast('Hãy tải file thiết kế lên trước.'); return false; }
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

// Nhận artwork mới: lưu raster + tỉ lệ gốc, đặt lại vị trí/cỡ in, đánh giá chất lượng
async function setArtwork(rasterCanvas, name, kind, svgText) {
  const w = rasterCanvas.width, h = rasterCanvas.height;
  if (!w || !h) throw new Error('EMPTY');
  S.art = { raster: rasterCanvas, svgText, w, h, aspect: w / h, name, kind, colorCount: 0, typeLabel: '' };
  const an = analyzeArtwork(rasterCanvas);
  S.art.colorCount = an.colors;
  S.art.typeLabel = an.kind === 'flat' ? 'Hình phẳng, ít màu' : 'Ảnh phức tạp';
  resetDesign();
  assess();
  render(); updatePrintPanel(); checkWarnings();
  $('fileInfo').innerHTML = `<b>${esc(name)}</b><br>${w} × ${h} px · ${S.art.typeLabel}`;
  toast('Đã tải file xong.');
}

// ---------- Khử nền trắng ----------
// Pixel gần trắng thành trong suốt (viền feather nhẹ). Giữ nguyên kích thước/tỉ lệ.
function btnWhite() {
  if (!needArt()) return;
  const src = S.art.raster;
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
      S.art.raster = cv; S.art.svgText = null; S.art.kind = 'raster';
      afterProcess('Đã khử nền trắng.');
    });
}

// ---------- Crop: mở modal, kéo khung chữ nhật, áp dụng ----------
// Crop tạo artwork mới (tỉ lệ mới = tỉ lệ khung crop) — không làm méo hình.
let cropSt = null;

function openCrop() {
  if (!needArt()) return;
  const src = S.art.raster;
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
  const src = S.art.raster;
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
  const src = S.art.raster;
  const x = clamp(Math.round(x0 / s.sc), 0, src.width - 1);
  const y = clamp(Math.round(y0 / s.sc), 0, src.height - 1);
  const w = clamp(Math.round((x1 - x0) / s.sc), 1, src.width - x);
  const h = clamp(Math.round((y1 - y0) / s.sc), 1, src.height - y);
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  cv.getContext('2d').drawImage(src, x, y, w, h, 0, 0, w, h);
  S.art.raster = cv; S.art.svgText = null; S.art.kind = 'raster';
  S.art.w = w; S.art.h = h; S.art.aspect = w / h;
  $('modalCrop').hidden = true;
  afterProcess('Đã cắt artwork theo khung.');
}

// =====================================================================
// PHẦN 3: Đánh giá chất lượng in, so sánh trước/sau, vector tracing, upscale
// =====================================================================

// DPI thực tế = pixel artwork / khổ in (inch). Lấy chiều nhỏ nhất (trường hợp xấu nhất).
function artworkDPI() {
  if (!S.art || !S.design) return 0;
  const dpiW = S.art.w / (S.design.wCm / 2.54);
  const dpiH = S.art.h / (S.design.hCm / 2.54);
  return Math.min(dpiW, dpiH);
}

// Phân loại artwork: đếm số màu (lượng tử 4 bit/kênh) trên ảnh thu nhỏ.
// Ít màu -> "flat" (hợp vector); nhiều màu -> "photo" (hợp phóng nét).
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
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 128) continue;
    set.add(((d[i] >> 4) << 8) | ((d[i + 1] >> 4) << 4) | (d[i + 2] >> 4));
    if (set.size > 200) break;
  }
  const colors = set.size;
  return { colors, kind: colors <= 40 ? 'flat' : 'photo' };
}

// Tự động đánh giá mỗi khi thêm artwork hoặc đổi khổ in.
// Ngưỡng: >=300 xanh (đạt chuẩn), 150-300 vàng (nên xử lý), <150 đỏ (không nên in).
// Đề xuất chỉ là gợi ý — người dùng chốt tay sau khi so sánh.
function assess() {
  const box = $('dpiBox'), sg = $('suggestBox');
  if (!S.art || !S.design) { box.hidden = true; sg.hidden = true; return; }
  const dpi = artworkDPI();
  box.hidden = false; sg.hidden = false;
  const badge = $('dpiBadge');
  let cls, label;
  if (dpi >= 300) { cls = 'ok'; label = 'Đạt chuẩn in'; }
  else if (dpi >= 150) { cls = 'warn'; label = 'Nên xử lý thêm'; }
  else { cls = 'bad'; label = 'Không nên in'; }
  badge.className = 'badge ' + cls;
  badge.textContent = label;
  $('dpiText').textContent =
    `DPI thực tế: ${Math.round(dpi)} (khổ ${fmt(S.design.wCm)} × ${fmt(S.design.hCm)} cm)`;

  const rec = dpi >= 300 ? 'keep'
    : (S.art.typeLabel.indexOf('Hình phẳng') === 0 ? 'vector' : 'up');
  const note = $('suggestNote');
  ['sgKeep', 'sgVector', 'sgUp2', 'sgUp4'].forEach((id) => $(id).classList.remove('rec'));
  if (rec === 'keep') {
    $('sgKeep').classList.add('rec');
    note.textContent = 'File đã đủ 300dpi ở khổ in này — giữ nguyên là in đẹp.';
  } else if (rec === 'vector') {
    $('sgVector').classList.add('rec');
    note.textContent = `Hình phẳng ít màu (${S.art.colorCount} màu) — chuyển vector cho nét ở mọi khổ in.`;
  } else {
    $('sgUp4').classList.add('rec');
    note.textContent = 'Ảnh phức tạp — vector sẽ méo hình, nên phóng nét để tăng mật độ điểm ảnh.';
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
      const { svg, layers, skippedWhite } = traceArtwork(S.art.raster, 8);
      rasterizeSVG(svg, 1600).then((raster) => {
        openCompare(
          S.art.raster, raster, 'So sánh: gốc vs vector',
          `Tracing tạo ${layers} lớp path vector thật${skippedWhite ? ' (đã bỏ nền trắng)' : ''}. ` +
          'Kiểm tra kỹ ở 100%: nếu méo hình thì bấm “Bỏ qua” và dùng Phóng nét.',
          () => {
            S.art.raster = raster;
            S.art.svgText = svg;   // giữ vector thật để xuất file in SVG
            S.art.kind = 'vector';
            S.art.w = raster.width; S.art.h = raster.height; // tỉ lệ giữ nguyên
            S.art.colorCount = layers;
            afterProcess('Đã chuyển vector.');
          }
        );
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
  // Thu nhỏ để tracing nhanh; path sẽ scale lại đúng kích thước gốc
  const MAXS = 420;
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

  // 3) Mỗi lớp màu: mask nhị phân -> marching squares -> nối đoạn -> gọn path
  const kx = srcCanvas.width / tw, ky = srcCanvas.height / th;
  let paths = '';
  palette.forEach((col, li) => {
    const mask = new Uint8Array(n);
    for (let i = 0; i < n; i++) mask[i] = labels[i] === li ? 1 : 0;
    const segs = marchingSquares(mask, tw, th);
    if (!segs.length) return;
    const hex = '#' + col.map((v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('');
    chainSegments(segs).forEach((pts) => {
      if (pts.length < 2) return;
      const sp = simplify(pts, 0.9);
      let s = `M${(sp[0][0] * kx).toFixed(1)} ${(sp[0][1] * ky).toFixed(1)}`;
      for (let k = 1; k < sp.length; k++) {
        s += `L${(sp[k][0] * kx).toFixed(1)} ${(sp[k][1] * ky).toFixed(1)}`;
      }
      if (isClosed(pts)) s += 'Z';
      paths += `<path d="${s}" fill="${hex}"/>`;
    });
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
function btnUpscale(f) {
  if (!needArt()) return;
  const src = S.art.raster;
  const cv = document.createElement('canvas');
  cv.width = src.width * f; cv.height = src.height * f;
  const ctx = cv.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(src, 0, 0, cv.width, cv.height);
  openCompare(src, cv, `So sánh: gốc vs phóng nét ${f}× (nội suy)`,
    'Phóng nét nội suy chỉ tăng mật độ điểm ảnh, không thêm chi tiết thật như AI upscale.',
    () => {
      S.art.raster = cv; S.art.svgText = null; S.art.kind = 'raster';
      S.art.w = cv.width; S.art.h = cv.height; // tỉ lệ giữ nguyên (cùng nhân f)
      afterProcess(`Đã phóng nét ${f}×.`);
    });
}

// Cập nhật sau mỗi lần xử lý: đếm lại màu, đánh giá DPI, vẽ lại
function afterProcess(msg) {
  const an = analyzeArtwork(S.art.raster);
  if (!S.art.svgText) S.art.colorCount = an.colors;
  assess(); render(); updatePrintPanel(); checkWarnings();
  $('fileInfo').innerHTML =
    `<b>${esc(S.art.name)}</b><br>${S.art.w} × ${S.art.h} px · ` +
    (S.art.svgText ? 'Đã vector hóa' : S.art.typeLabel);
  toast(msg);
}

// =====================================================================
// PHẦN 4: Cảnh báo vùng in, panel số đo, xuất file, khởi động app
// =====================================================================

// Cảnh báo khi design tràn khỏi zone an toàn hoặc đè lên vùng cấm
// (cổ áo, nẹp nút, đường may trong warnZones của config)
function checkWarnings() {
  const bar = $('warnBar');
  if (!S.art || !S.design) { bar.hidden = true; return; }
  const W = S.cfg.kichThuocAnh.w, H = S.cfg.kichThuocAnh.h;
  const r = designPx();
  const bx0 = r.x / W, by0 = r.y / H;
  const bx1 = (r.x + r.w) / W, by1 = (r.y + r.h) / H;
  const msgs = [], danger = [];
  const p = curPos(), z = p.zone;
  if (bx0 < z.x0 || by0 < z.y0 || bx1 > z.x1 || by1 > z.y1) {
    msgs.push(`Hình in tràn ra khỏi vùng in an toàn của vị trí “${p.ten}”.`);
  }
  (S.cfg.warnZones || []).forEach((wz) => {
    let hit = false;
    if (wz.loai === 'tron') {
      const cx = wz.x * W, cy = wz.y * H, rr = wz.r * Math.min(W, H);
      const nx = clamp(cx, r.x, r.x + r.w), ny = clamp(cy, r.y, r.y + r.h);
      hit = Math.hypot(cx - nx, cy - ny) < rr;
    } else { // chunhat
      hit = !(bx1 < wz.x0 || bx0 > wz.x1 || by1 < wz.y0 || by0 > wz.y1);
    }
    if (hit) danger.push(`Hình in đè lên vùng “${wz.ten}” — nên dời ra.`);
  });
  const all = danger.concat(msgs);
  bar.hidden = !all.length;
  bar.className = 'warnbar' + (danger.length ? ' danger' : '');
  bar.innerHTML = all.map((m) => '• ' + esc(m)).join('<br>');
}

// Panel thông số áo + tỉ lệ px/cm hiện tại
function updateShirtPanel() {
  const a = S.cfg.ao;
  $('shirtInfo').innerHTML =
    `Áo: <b>${esc(a.kieu)}</b>, size ${esc(a.size)} — ` +
    `Ngang ngực <b>${fmt(a.ngangNgucCm)}</b> cm, Dài <b>${fmt(a.daiAoCm)}</b> cm` +
    `<br><span class="muted small">Tỉ lệ ảnh: ${fmt(pxPerCm(), 2)} px/cm</span>`;
}

// Panel số đo hình in: rộng × cao (cm), px @300dpi, DPI thực tế
function updatePrintPanel() {
  const el = $('printInfo');
  if (!S.art || !S.design) {
    el.innerHTML = '<span class="muted">Chưa có file thiết kế.</span>';
    return;
  }
  const pxW = Math.round((S.design.wCm / 2.54) * 300);
  const pxH = Math.round((S.design.hCm / 2.54) * 300);
  el.innerHTML =
    `Hình in: <b>${fmt(S.design.wCm)} × ${fmt(S.design.hCm)} cm</b> — ` +
    `${pxW} × ${pxH} px @300dpi` +
    `<br>DPI thực tế: <b>${Math.round(artworkDPI())}</b> · Vị trí: ${esc(curPos().ten)}` +
    (S.art.svgText ? '<br><span class="muted small">Đã vector hóa — xuất được file SVG.</span>' : '');
}

// ---------- Xuất file ----------

// (a) Xuất mockup PNG full-res: hiện preview + nút tải rõ ràng
function exportMockup() {
  if (!needArt()) return;
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
    dl.download = `mockup-${S.mockupId}-${S.posId}.png`;
    $('modalPreview').hidden = false;
    toast('Đã tạo mockup — bấm “Tải PNG về máy”.');
  }, 'image/png');
}

// (b1) Xuất file in: PNG nền trong suốt, 300dpi, đúng khổ cm (giữ tỉ lệ)
function exportPrintPNG() {
  if (!needArt()) return;
  const pw = Math.round((S.design.wCm / 2.54) * 300);
  const ph = Math.round((S.design.hCm / 2.54) * 300);
  const cv = document.createElement('canvas');
  cv.width = pw; cv.height = ph;
  const ctx = cv.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(S.art.raster, 0, 0, pw, ph);
  cv.toBlob((b) => {
    if (!b) { toast('Xuất file in thất bại.'); return; }
    download(b, `file-in-${S.posId}-${fmt(S.design.wCm)}x${fmt(S.design.hCm)}cm-300dpi.png`);
    toast('Đã xuất file in PNG 300dpi.');
  }, 'image/png');
}

// (b2) Xuất file in SVG — chỉ khi đã có vector (tải SVG lên hoặc đã tracing)
function exportPrintSVG() {
  if (!needArt()) return;
  if (!S.art.svgText) {
    toast('Chưa có vector. Hãy bấm “Chuyển vector” hoặc tải file SVG lên trước.');
    return;
  }
  download(new Blob([S.art.svgText], { type: 'image/svg+xml' }),
    `file-in-${S.posId}.svg`);
  toast('Đã xuất file in SVG.');
}

// (c) Xuất phiếu kỹ thuật .txt gửi nhà in
function exportSpec() {
  if (!needArt()) return;
  const a = S.cfg.ao;
  const lines = [
    'PHIEU KY THUAT IN AO',
    '=====================',
    `Khach hang: ${$('inpCust').value || '—'}`,
    `Ma don: ${$('inpCode').value || '—'}`,
    `Mockup: ${S.cfg.ten} (${a.kieu}, size ${a.size})`,
    `Vi tri in: ${curPos().ten}`,
    `Kich thuoc hinh in: ${fmt(S.design.wCm)} x ${fmt(S.design.hCm)} cm`,
    `DPI thuc te: ${Math.round(artworkDPI())}`,
    `So mau artwork: ${S.art.colorCount}`,
    `File thiet ke: ${S.art.name}${S.art.svgText ? ' (da vector hoa)' : ''}`,
    `Phuong phap in: ${$('selMethod').value}`,
    `Ngay chot: ${$('inpDate').value || '—'}`,
    `Ti le px/cm hieu chuan: ${fmt(pxPerCm(), 2)}`,
  ];
  const code = ($('inpCode').value || 'don').replace(/[^\w-]+/g, '-');
  download(new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' }),
    `phieu-ky-thuat-${code}.txt`);
  toast('Đã xuất phiếu kỹ thuật.');
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

  $('selPos').onchange = (e) => {
    S.posId = e.target.value;
    resetDesign(); assess();
    render(); updatePrintPanel(); checkWarnings();
  };

  $('inpW').addEventListener('change', () => {
    if (!S.design || !S.art) return;
    const v = parseFloat($('inpW').value);
    if (v > 0) setPrintWidth(v);
    render(); updatePrintPanel(); checkWarnings(); assess();
  });
  $('inpH').addEventListener('change', () => {
    if (!S.design || !S.art) return;
    const v = parseFloat($('inpH').value);
    if (v > 0) setPrintHeight(v);
    render(); updatePrintPanel(); checkWarnings(); assess();
  });

  // Quy tắc cứng: tỉ lệ luôn khóa — bấm vào chỉ để xem giải thích
  $('btnLock').onclick = () =>
    toast('Tỉ lệ luôn được khóa để không méo hình — mọi thao tác đều giữ đúng tỉ lệ gốc.');

  $('inpChest').addEventListener('change', () => {
    const v = parseFloat($('inpChest').value);
    if (v > 0 && S.cfg) {
      S.cfg.ao.ngangNgucCm = v; // hiệu chuẩn lại -> pxPerCm() tự tính lại
      updateShirtPanel();
      render(); updatePrintPanel(); checkWarnings(); assess();
    }
  });

  // Nút xử lý ảnh
  $('btnVector').onclick = btnVector;
  $('btnUp2').onclick = () => btnUpscale(2);
  $('btnUp4').onclick = () => btnUpscale(4);
  $('btnWhite').onclick = btnWhite;
  $('btnCrop').onclick = openCrop;
  $('cropCancel').onclick = () => { $('modalCrop').hidden = true; };
  $('cropApply').onclick = applyCrop;
  $('btnKeep').onclick = () => {
    if (!needArt()) return;
    toast('Đang dùng file gốc — không cần xử lý thêm.');
  };

  // Nút đề xuất trong panel đánh giá
  $('sgKeep').onclick = () => toast('File đang dùng bản gốc — không cần xử lý thêm.');
  $('sgVector').onclick = btnVector;
  $('sgUp2').onclick = () => btnUpscale(2);
  $('sgUp4').onclick = () => btnUpscale(4);

  // Nút xuất file
  $('btnExpMockup').onclick = exportMockup;
  $('btnExpPrint').onclick = exportPrintPNG;
  $('btnExpSVG').onclick = exportPrintSVG;
  $('btnExpSpec').onclick = exportSpec;

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
