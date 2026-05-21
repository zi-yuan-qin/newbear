const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const ROOT = path.resolve(__dirname, "..");
const EXT = process.argv.includes("--mp4") ? "mp4" : "webm";
const OUTPUT_MIME = EXT === "mp4" ? "video/mp4;codecs=avc1.42E01E,mp4a.40.2" : "";
const OUT = path.join(ROOT, "docs", `熊心壮职_30s_宣传视频.${EXT}`);

function dataUrl(file) {
  const ext = path.extname(file).toLowerCase();
  const mime = ext === ".jpg" || ext === ".jpeg" ? "image/jpeg" : ext === ".webp" ? "image/webp" : "image/png";
  return `data:${mime};base64,${fs.readFileSync(file).toString("base64")}`;
}

const assets = {
  cover: dataUrl(path.join(ROOT, "docs/cover.png")),
  map: dataUrl(path.join(ROOT, "frontend/web/assets/map_slices/map_layer_001_-1.png")),
  meeting: dataUrl(path.join(ROOT, "frontend/web/assets/meeting/room.jpg")),
  pantry: dataUrl(path.join(ROOT, "frontend/web/assets/pantry/room.png")),
  market: dataUrl(path.join(ROOT, "frontend/web/assets/actors/xiongshichang/idle_front.webp")),
  boss: dataUrl(path.join(ROOT, "frontend/web/assets/actors/xionglaoban/idle_front.webp")),
  admin: dataUrl(path.join(ROOT, "frontend/web/assets/actors/xiongxingzheng/idle_front.webp")),
  tech: dataUrl(path.join(ROOT, "frontend/web/assets/actors/xiongjishu/idle_front.webp")),
  qr: dataUrl(path.join(ROOT, "docs/newbear_qr.png")),
};

function readVint(buffer, offset) {
  const first = buffer[offset];
  let mask = 0x80;
  let length = 1;
  while (length <= 8 && !(first & mask)) {
    mask >>= 1;
    length++;
  }
  let value = first & (mask - 1);
  for (let i = 1; i < length; i++) value = value * 256 + buffer[offset + i];
  return { length, value };
}

function writeVint(value, length) {
  const out = Buffer.alloc(length);
  for (let i = length - 1; i >= 0; i--) {
    out[i] = value & 0xff;
    value = Math.floor(value / 256);
  }
  out[0] |= 1 << (8 - length);
  return out;
}

function addWebmDuration(buffer, durationMs) {
  const infoId = Buffer.from([0x15, 0x49, 0xa9, 0x66]);
  const durationId = Buffer.from([0x44, 0x89]);
  const infoStart = buffer.indexOf(infoId);
  if (infoStart < 0) return buffer;
  const sizeOffset = infoStart + infoId.length;
  const size = readVint(buffer, sizeOffset);
  const contentStart = sizeOffset + size.length;
  const contentEnd = contentStart + size.value;
  if (buffer.indexOf(durationId, contentStart) >= 0 && buffer.indexOf(durationId, contentStart) < contentEnd) return buffer;
  const duration = Buffer.alloc(11);
  duration[0] = 0x44;
  duration[1] = 0x89;
  duration[2] = 0x88;
  duration.writeDoubleBE(durationMs, 3);
  const newInfoSize = size.value + duration.length;
  const newSize = writeVint(newInfoSize, size.length);
  return Buffer.concat([
    buffer.subarray(0, sizeOffset),
    newSize,
    buffer.subarray(contentStart, contentEnd),
    duration,
    buffer.subarray(contentEnd),
  ]);
}

const html = String.raw`<!doctype html>
<meta charset="utf-8">
<canvas id="c" width="1080" height="1920"></canvas>
<script>
const assets = ${JSON.stringify(assets)};
const outputMime = ${JSON.stringify(OUTPUT_MIME)};
const canvas = document.getElementById("c");
const ctx = canvas.getContext("2d");
const W = canvas.width, H = canvas.height;
const DURATION = 30;
const FPS = 30;
const img = {};
const load = (name, src) => new Promise((resolve) => {
  const im = new Image();
  im.onload = () => { img[name] = im; resolve(); };
  im.src = src;
});
const ease = x => x < 0 ? 0 : x > 1 ? 1 : x * x * (3 - 2 * x);
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const lerp = (a, b, p) => a + (b - a) * p;
function local(t, a, b) { return clamp((t - a) / (b - a)); }
function alpha(t, a, b, fade = .45) {
  return clamp(Math.min(local(t, a, a + fade), 1 - local(t, b - fade, b)));
}
function bg(color = "#f5ead3") {
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, W, H);
  const g = ctx.createRadialGradient(W * .25, H * .18, 20, W * .5, H * .4, H);
  g.addColorStop(0, "rgba(255,255,255,.72)");
  g.addColorStop(.55, "rgba(241,211,150,.28)");
  g.addColorStop(1, "rgba(122,141,94,.18)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}
function rounded(x, y, w, h, r = 28, fill = "#fff8e8", stroke = "rgba(116,78,42,.22)", lw = 3) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); }
}
function text(s, x, y, size, color = "#4b2d1d", weight = 700, align = "left", line = 1.28) {
  ctx.font = weight + " " + size + "px \"Noto Sans SC\",\"Microsoft YaHei\",sans-serif";
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = "top";
  const lines = String(s).split("\n");
  lines.forEach((l, i) => ctx.fillText(l, x, y + i * size * line));
}
function fitImage(im, x, y, w, h, mode = "cover", opacity = 1) {
  ctx.save();
  ctx.globalAlpha *= opacity;
  const ir = im.width / im.height, r = w / h;
  let sw = im.width, sh = im.height, sx = 0, sy = 0;
  if ((mode === "cover" && ir > r) || (mode === "contain" && ir < r)) {
    sw = im.height * r; sx = (im.width - sw) / 2;
  } else {
    sh = im.width / r; sy = (im.height - sh) / 2;
  }
  ctx.drawImage(im, sx, sy, sw, sh, x, y, w, h);
  ctx.restore();
}
function shadow() {
  ctx.shadowColor = "rgba(68,42,21,.18)";
  ctx.shadowBlur = 26;
  ctx.shadowOffsetY = 14;
}
function vignette() {
  const g = ctx.createRadialGradient(W / 2, H / 2, 300, W / 2, H / 2, 1000);
  g.addColorStop(0, "rgba(255,255,255,0)");
  g.addColorStop(1, "rgba(77,45,23,.20)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}
function pill(s, x, y, w, color = "#6f8c55") {
  rounded(x, y, w, 64, 32, color, null);
  text(s, x + w / 2, y + 15, 28, "#fffaf1", 800, "center");
}
function drawFooter(progress = 0) {
  ctx.globalAlpha = .82;
  rounded(68, 1698, 944, 92, 28, "rgba(255,248,232,.76)", "rgba(126,92,48,.22)", 2);
  ctx.globalAlpha = 1;
  const filled = 944 * clamp(progress);
  rounded(68, 1698, filled, 92, 28, "rgba(105,139,82,.82)", null);
  text("AI职场人格探索游戏", 100, 1727, 30, "#5f432c", 800);
  text("熊心壮职", 890, 1727, 30, "#4b2d1d", 900, "right");
}
function drawActor(im, x, y, s = 1, bob = 0) {
  ctx.save();
  shadow();
  ctx.drawImage(im, x, y + Math.sin(bob) * 7, 142 * s, 190 * s);
  ctx.restore();
}
function drawRadar(cx, cy, r, p) {
  ctx.strokeStyle = "rgba(116,78,42,.28)";
  ctx.lineWidth = 3;
  for (let k = 1; k <= 4; k++) {
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + i * Math.PI * 2 / 5;
      const rr = r * k / 4;
      const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr;
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.closePath(); ctx.stroke();
  }
  const vals = [.74, .62, .86, .55, .69].map(v => v * p);
  ctx.beginPath();
  vals.forEach((v, i) => {
    const a = -Math.PI / 2 + i * Math.PI * 2 / 5;
    const x = cx + Math.cos(a) * r * v, y = cy + Math.sin(a) * r * v;
    i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  });
  ctx.closePath();
  ctx.fillStyle = "rgba(189,143,67,.38)";
  ctx.fill();
  ctx.strokeStyle = "#a46a2b";
  ctx.lineWidth = 5;
  ctx.stroke();
}
function subtitle(s) {
  rounded(90, 1458, 900, 156, 30, "rgba(255,250,239,.88)", "rgba(120,83,46,.18)", 2);
  text(s, 540, 1492, 44, "#4a2c1d", 900, "center", 1.22);
}
function frame(t) {
  bg();
  const p = t / DURATION;
  if (t < 1) {
    fitImage(img.cover, 0, 0, W, H, "cover", 1);
    return;
  }
  if (t < 4) {
    const a = alpha(t, 0, 4);
    ctx.globalAlpha = a;
    fitImage(img.map, -250 + ease(local(t,0,4))*70, 330, 1560, 960, "contain", .92);
    vignette();
    text("AI职场人格探索游戏", 92, 126, 34, "#6f8c55", 900);
    text("熊心\n壮职", 86, 205, 168, "#6a3d20", 900, "left", .92);
    pill("AI驱动的沉浸式职场人格探索", 90, 558, 650);
    subtitle("如果有一天，\n你进入了一家由 AI 驱动的公司。");
    drawFooter(p);
    ctx.globalAlpha = 1;
  } else if (t < 8) {
    fitImage(img.pantry, -170, 120, 1420, 1010, "cover", .65);
    rounded(74, 112, 932, 1260, 42, "rgba(255,249,236,.78)", "rgba(135,96,48,.22)", 3);
    text("在那里，每个人都有自己的性格、立场与压力。", 118, 170, 40, "#4b2d1d", 900);
    const names = [["熊市场","追求增长",img.market],["熊老板","长期稳定",img.boss],["熊行政","团队风险",img.admin],["熊技术","结构质量",img.tech]];
    names.forEach((n, i) => {
      const x = 118 + (i % 2) * 442, y = 290 + Math.floor(i / 2) * 394;
      rounded(x, y, 386, 318, 28, "rgba(255,253,246,.90)", "rgba(176,130,67,.34)", 3);
      drawActor(n[2], x + 26, y + 54, .72, t * 4 + i);
      text(n[0], x + 188, y + 66, 42, "#4b2d1d", 900);
      text(n[1], x + 188, y + 125, 30, "#7d6644", 800);
      ctx.fillStyle = ["#d48742","#789a5d","#c89d57","#747b88"][i];
      ctx.fillRect(x + 188, y + 184, 130 + i * 22, 16);
      ctx.fillStyle = "rgba(76,45,25,.14)";
      ctx.fillRect(x + 188, y + 214, 150, 16);
    });
    subtitle("有人追求增长，有人坚持稳定。\n有人冒险，也有人更在意团队与风险。");
    drawFooter(p);
  } else if (t < 13) {
    fitImage(img.map, -360 + local(t,8,13)*140, 380, 1620, 940, "contain", .52);
    const flash = Math.sin(t * 16) > .55 ? .18 : 0;
    ctx.fillStyle = "rgba(176,80,37," + (.22 + flash) + ")";
    ctx.fillRect(0, 0, W, H);
    shadow();
    rounded(86, 450, 908, 462, 36, "#f2c16a", "#ad6628", 7);
    ctx.shadowColor = "transparent";
    text("09:30 · 突发事件", 132, 514, 30, "#6b4427", 900);
    text("发布会前\n核心功能崩溃", 130, 578, 74, "#4a2417", 900, "left", 1.1);
    text("距离产品发布会仅剩 3 天，\n修好至少需要 5 天。", 132, 752, 34, "#6a4328", 800, "left", 1.35);
    subtitle("而当真正的危机突然出现——\n你，会怎么选？");
    drawFooter(p);
  } else if (t < 20) {
    fitImage(img.meeting, -190, 160, 1460, 1000, "cover", .5);
    rounded(68, 100, 944, 520, 38, "rgba(255,251,241,.88)", "rgba(136,98,56,.22)", 3);
    text("团队会议", 112, 144, 34, "#8a6b45", 800);
    text("窗口期已经打开，\n要先冲市场还是先补稳定性？", 112, 200, 58, "#412719", 900, "left", 1.16);
    const cards = [
      ["先冲市场", "抢占窗口，允许产品先带小瑕疵跑。"],
      ["先稳质量", "暂停大动作，集中解决关键稳定性问题。"],
      ["缩范围推进", "小支点发布，主力先做关键修复。"],
    ];
    cards.forEach((c, i) => {
      const y = 690 + i * 164;
      rounded(94, y, 892, 118, 24, i === 2 ? "#e6f2db" : "rgba(255,250,239,.88)", i === 2 ? "#7ca269" : "rgba(176,130,67,.34)", 3);
      text(c[0], 134, y + 24, 34, "#5a371f", 900);
      text(c[1], 134, y + 70, 24, "#79644a", 700);
    });
    rounded(116, 1200, 848, 190, 30, "rgba(255,253,248,.86)", "rgba(122,86,48,.20)", 2);
    text("你的每一次发言，每一个判断，\n都会影响团队关系、项目走向，甚至公司的未来。", 540, 1240, 40, "#4a2c1d", 900, "center", 1.28);
    drawFooter(p);
  } else if (t < 25) {
    fitImage(img.pantry, -250, 60, 1580, 1120, "cover", .34);
    rounded(92, 166, 896, 1048, 42, "rgba(255,252,243,.90)", "rgba(133,100,58,.22)", 3);
    text("AI 实时记录中", 136, 230, 50, "#4b2d1d", 900);
    text("行为 · 情绪 · 决策", 136, 304, 34, "#6f8c55", 900);
    const rp = ease(local(t, 20, 25));
    drawRadar(540, 700, 250, rp);
    text("人格侧写：责任性与情绪稳定更突出", 540, 1000, 36, "#6b4d2e", 900, "center");
    subtitle("AI 会记录你的行为、情绪与决策。\n逐渐描绘出真正的你。");
    drawFooter(p);
  } else if (t < 29) {
    fitImage(img.map, -310, 250, 1700, 1050, "contain", .48);
    rounded(76, 238, 928, 452, 38, "rgba(255,252,244,.88)", "rgba(133,100,58,.22)", 3);
    rounded(76, 780, 928, 452, 38, "rgba(255,252,244,.88)", "rgba(133,100,58,.22)", 3);
    drawActor(img.admin, 130, 378, .82, t * 4);
    drawActor(img.market, 130, 920, .82, t * 4 + 1);
    text("冷静理性的执行者？", 360, 372, 56, "#3e2a1e", 900);
    text("先守住承诺，厘清影响范围。", 360, 462, 32, "#76604a", 800);
    text("愿意承担风险的推动者？", 360, 914, 56, "#3e2a1e", 900);
    text("抓住窗口，推动团队向前。", 360, 1004, 32, "#76604a", 800);
    subtitle("你是冷静理性的执行者？\n还是愿意承担风险的推动者？");
    drawFooter(p);
  } else {
    bg("#f2e6cb");
    fitImage(img.map, -350, 350, 1800, 1000, "contain", .45);
    vignette();
    text("熊心\n壮职", 540, 250, 168, "#63391f", 900, "center", .92);
    pill("在 AI 职场里，发现真正的你", 190, 620, 700, "#6f8c55");
    rounded(236, 1082, 608, 114, 34, "#6f8c55", null);
    text("开始人格探索之旅", 540, 1112, 42, "#fffaf0", 900, "center");
    rounded(404, 1240, 272, 272, 30, "#fffdf6", "rgba(120,83,46,.25)", 3);
    ctx.drawImage(img.qr, 428, 1264, 224, 224);
    text("扫码开启你的 AI 职场人生", 540, 1538, 30, "#5c452e", 800, "center");
    drawFooter(1);
  }
}
async function makeMusic(dest) {
  const ac = dest.context;
  const master = ac.createGain();
  master.gain.value = .20;
  master.connect(dest);
  const notes = [261.63, 329.63, 392, 523.25, 392, 329.63, 293.66, 392];
  for (let i = 0; i < DURATION * 4; i++) {
    const start = ac.currentTime + i * .25;
    const freq = notes[i % notes.length] * (i > 32 ? 1.12 : 1);
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = i % 4 === 0 ? "triangle" : "sine";
    o.frequency.setValueAtTime(freq, start);
    g.gain.setValueAtTime(0, start);
    g.gain.linearRampToValueAtTime(i % 4 === 0 ? .18 : .08, start + .025);
    g.gain.exponentialRampToValueAtTime(.002, start + .22);
    o.connect(g).connect(master);
    o.start(start);
    o.stop(start + .25);
  }
  for (let i = 0; i < DURATION * 2; i++) {
    const start = ac.currentTime + i * .5;
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(i % 2 ? 196 : 130.81, start);
    g.gain.setValueAtTime(0, start);
    g.gain.linearRampToValueAtTime(.12, start + .04);
    g.gain.exponentialRampToValueAtTime(.002, start + .42);
    o.connect(g).connect(master);
    o.start(start);
    o.stop(start + .45);
  }
  return ac;
}
async function record() {
  await Promise.all(Object.entries(assets).map(([k, v]) => load(k, v)));
  const audio = new AudioContext();
  const dest = audio.createMediaStreamDestination();
  await makeMusic(dest);
  const stream = canvas.captureStream(FPS);
  const mixed = new MediaStream([...stream.getVideoTracks(), ...dest.stream.getAudioTracks()]);
  const mime = outputMime && MediaRecorder.isTypeSupported(outputMime)
    ? outputMime
    : MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus") ? "video/webm;codecs=vp9,opus" : "video/webm";
  const rec = new MediaRecorder(mixed, { mimeType: mime, videoBitsPerSecond: 6500000, audioBitsPerSecond: 128000 });
  const chunks = [];
  rec.ondataavailable = e => e.data.size && chunks.push(e.data);
  const start = performance.now();
  const draw = () => {
    const t = Math.min((performance.now() - start) / 1000, DURATION);
    frame(t);
    if (t < DURATION) requestAnimationFrame(draw);
  };
  frame(0);
  rec.start(250);
  draw();
  await new Promise(resolve => setTimeout(resolve, (DURATION + .35) * 1000));
  rec.stop();
  await new Promise(resolve => rec.onstop = resolve);
  const blob = new Blob(chunks, { type: mime });
  const ab = await blob.arrayBuffer();
  return Array.from(new Uint8Array(ab));
}
</script>`;

(async () => {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  const browser = await chromium.launch({
    headless: true,
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  });
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  await page.setContent(html, { waitUntil: "load" });
  const bytes = await page.evaluate(() => record());
  const video = Buffer.from(bytes);
  fs.writeFileSync(OUT, EXT === "webm" ? addWebmDuration(video, 30000) : video);
  await browser.close();
  console.log(OUT);
})();
