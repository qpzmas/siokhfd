#!/usr/bin/env node
// ============================================================================
//  fatfish · 大肥鱼
//  一条住在你终端里的鱼。零依赖，真彩色，半块字符当像素。
//
//  npx github:qpzmas/siokhfd
// ============================================================================
import process from "node:process";
import fs from "node:fs";

// ---------------------------------------------------------------- 小工具 ---
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (e0, e1, x) => {
  const t = clamp01((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
};
const pack = (r, g, b) =>
  ((clamp(r | 0, 0, 255) << 16) | (clamp(g | 0, 0, 255) << 8) | clamp(b | 0, 0, 255));
const C = (hex) => hex;
function mix(a, b, t) {
  if (t <= 0) return a;
  if (t >= 1) return b;
  return pack(
    lerp((a >> 16) & 255, (b >> 16) & 255, t),
    lerp((a >> 8) & 255, (b >> 8) & 255, t),
    lerp(a & 255, b & 255, t)
  );
}
function shade(c, f) {
  return pack(((c >> 16) & 255) * f, ((c >> 8) & 255) * f, (c & 255) * f);
}
function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
// 显示宽度：CJK / 全角算 2
function dispWidth(s) {
  let n = 0;
  for (const ch of s) {
    const c = ch.codePointAt(0);
    if (
      (c >= 0x1100 && c <= 0x115f) ||
      (c >= 0x2e80 && c <= 0xa4cf) ||
      (c >= 0xac00 && c <= 0xd7a3) ||
      (c >= 0xf900 && c <= 0xfaff) ||
      (c >= 0xfe30 && c <= 0xfe6f) ||
      (c >= 0xff00 && c <= 0xff60) ||
      (c >= 0xffe0 && c <= 0xffe6)
    )
      n += 2;
    else n += 1;
  }
  return n;
}

// ------------------------------------------------------------- 命令行参数 ---
const HELP = [
  "",
  "  大肥鱼 fatfish · 一个住进你终端的零依赖水族箱",
  "",
  "  用法",
  "    npx github:qpzmas/siokhfd",
  "    node fatfish.mjs [选项]",
  "",
  "  按键",
  "    空格 / f   撒一把鱼食",
  "    n          白天 / 夜晚",
  "    r          重新开始",
  "    q          退出",
  "",
  "  选项",
  "    --once            画一帧就退出（截图用）",
  "    --night           从夜晚开始",
  "    --fps <n>         帧率，默认 30",
  "    --width <n>       画布宽度（字符）",
  "    --height <n>      画布高度（字符行）",
  "    --seed <n>        固定随机种子",
  "    --record <path>   录制像素帧到 <path>.json / <path>.bin",
  "    --frames <n>      录制帧数，默认 240",
  "    --demo            自动演示（默认开启：撒食、吃、入夜）",
  "    -h, --help        这段帮助",
  "",
].join("\n");

const argv = process.argv.slice(2);
const opt = {
  once: false,
  night: false,
  fps: 30,
  width: 0,
  height: 0,
  seed: -1,
  record: null,
  frames: 240,
  demo: false,
  hud: true,
};
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  const num = () => Number(argv[++i]);
  switch (a) {
    case "-h":
    case "--help":
      console.log(HELP);
      process.exit(0);
      break;
    case "--once":
    case "--frame":
      opt.once = true;
      break;
    case "--night":
      opt.night = true;
      break;
    case "--demo":
      opt.demo = true;
      break;
    case "--no-hud":
      opt.hud = false;
      break;
    case "--fps":
      opt.fps = clamp(num(), 5, 60);
      break;
    case "--width":
      opt.width = num();
      break;
    case "--height":
      opt.height = num();
      break;
    case "--seed":
      opt.seed = num();
      break;
    case "--frames":
      opt.frames = clamp(num(), 1, 4000);
      break;
    case "--record":
      opt.record = argv[++i];
      opt.demo = true;
      break;
    default:
      if (a.startsWith("-")) {
        console.error("不认识这个选项：" + a + "\n" + HELP);
        process.exit(1);
      }
  }
}
const rnd = mulberry32(opt.seed >= 0 ? opt.seed : (Date.now() ^ (Math.random() * 1e9)) >>> 0);

// ------------------------------------------------------------------ 调色板 ---
const PAL = {
  day: { top: C(0x1a6f7d), mid: C(0x0a3546), bot: C(0x04131c), beam: C(0x9fe8de) },
  night: { top: C(0x0d2044), mid: C(0x061024), bot: C(0x02060d), beam: C(0x8fb6ff) },
  sand: C(0x9a7647),
  sandLit: C(0xc9a06a),
  sandDark: C(0x5d4526),
  kelpA: C(0x2f7d5a),
  kelpB: C(0x63c98c),
  kelpC: C(0x1d5a45),
  fishTop: C(0xff7a2f),
  fishMid: C(0xff9840),
  fishBelly: C(0xffd79a),
  fishRim: C(0xb0381a),
  fishFin: C(0xffab52),
  fishFinEdge: C(0xe0662b),
  eyeWhite: C(0xfffaf0),
  eyeDark: C(0x1d2333),
  mouth: C(0x8e2c14),
  blush: C(0xff8f8f),
  pellet: C(0xffcf5c),
  pelletGlow: C(0xfff3b0),
  bubble: C(0xd8fbff),
  heart: C(0xff7fa8),
  star: C(0xdfe9ff),
};

// -------------------------------------------------------------- 像素画布 ---
class Canvas {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.d = new Uint32Array(w * h);
  }
  fill(c) {
    this.d.fill(c);
  }
  get(x, y) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return 0;
    return this.d[(y | 0) * this.w + (x | 0)];
  }
  px(x, y, c) {
    x |= 0;
    y |= 0;
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    this.d[y * this.w + x] = c;
  }
  // 半透明叠加
  add(x, y, c, a) {
    x |= 0;
    y |= 0;
    if (a <= 0 || x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = y * this.w + x;
    this.d[i] = mix(this.d[i], c, clamp01(a));
  }
}

// ------------------------------------------------------------------ 世界 ---
class World {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.t = 0;
    this.night = opt.night;
    this.fb = new Canvas(w, h);
    this.beam = new Float32Array(w);
    this.buildBg();
    this.placeKelp();
    this.buildSand();
    this.buildStars();
    this.buildDecor();
    this.fish = {
      x: w * 0.4,
      y: h * 0.45,
      vx: 8,
      vy: 0,
      dir: 1,
      r: Math.max(6, Math.min(12, h * 0.15)),
      full: 1,
      phase: rnd() * 6.28,
      blink: 0,
      blinkIn: 2 + rnd() * 3,
      mouth: 0,
      speed: 0,
      tx: w * 0.7,
      ty: h * 0.5,
      wander: 0,
    };
    this.pellets = [];
    this.parts = [];
    this.bubbles = [];
    this.fed = 0;
    this.satiety = 0;
    this.flash = 0;
    this.shake = 0;
    this.nightTimer = 0;
    this.plankton = [];
    for (let i = 0; i < Math.round(w * 0.7); i++) {
      this.plankton.push({
        x: rnd() * w,
        y: rnd() * h,
        v: 1 + rnd() * 3,
        p: rnd() * 6.28,
        a: 0.05 + rnd() * 0.14,
      });
    }
    for (let i = 0; i < Math.round(w * 0.18); i++) this.spawnBubble(true);
  }

  buildBg() {
    const p = this.night ? PAL.night : PAL.day;
    this.bg = new Uint32Array(this.h);
    for (let y = 0; y < this.h; y++) {
      const t = y / Math.max(1, this.h - 1);
      this.bg[y] = t < 0.5 ? mix(p.top, p.mid, t / 0.5) : mix(p.mid, p.bot, (t - 0.5) / 0.5);
    }
    this.beamColor = p.beam;
  }

  buildSand() {
    this.sandY = new Int16Array(this.w);
    for (let x = 0; x < this.w; x++) {
      const base = this.h * 0.87;
      this.sandY[x] = Math.round(
        base + Math.sin(x * 0.055 + 0.7) * this.h * 0.035 + Math.sin(x * 0.17 + 2.1) * 1.2
      );
    }
  }

  buildStars() {
    this.stars = [];
    for (let i = 0; i < 34; i++) {
      this.stars.push({
        x: Math.floor(rnd() * this.w),
        y: Math.floor(rnd() * this.h * 0.42),
        p: rnd() * 6.28,
        s: 0.4 + rnd() * 0.9,
      });
    }
  }

  placeKelp() {
    this.kelp = [];
    const n = Math.max(3, Math.round(this.w / 16));
    for (let i = 0; i < n; i++) {
      const x = 3 + (i + 0.15 + rnd() * 0.7) * ((this.w - 6) / n);
      this.kelp.push({
        x,
        h: this.h * (0.22 + rnd() * 0.4),
        p: rnd() * 6.28,
        sp: 0.5 + rnd() * 0.5,
        lean: (rnd() - 0.5) * 3,
        thick: rnd() < 0.3 ? 2 : 1,
        shade: rnd(),
      });
    }
  }

  // ------------------------------------------------------------- 生成物 ---
  spawnPellet() {
    this.pellets.push({
      x: 2 + rnd() * (this.w - 4),
      y: -2,
      vx: (rnd() - 0.5) * 2,
      vy: 6 + rnd() * 5,
      p: rnd() * 6.28,
      w: 0,
    });
  }
  spawnBubble(anywhere) {
    this.bubbles.push({
      x: rnd() * this.w,
      y: anywhere ? rnd() * this.h : this.sandY[Math.floor(rnd() * this.w)],
      v: 6 + rnd() * 12,
      r: rnd() < 0.25 ? 1 : 0.5,
      p: rnd() * 6.28,
      a: 0.25 + rnd() * 0.45,
    });
  }
  burst(x, y, n, kind) {
    for (let i = 0; i < n; i++) {
      const a = rnd() * 6.28;
      const s = (kind === "heart" ? 5 : 9) * (0.4 + rnd());
      this.parts.push({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s - (kind === "heart" ? 3 : 0),
        life: 0.5 + rnd() * 0.5,
        max: 1,
        kind,
        p: rnd() * 6.28,
      });
    }
  }

  // -------------------------------------------------------------- 更新 ---
  update(dt) {
    this.t += dt;
    const f = this.fish;
    const w = this.w,
      h = this.h;

    // 光束：每帧只算一次横向剖面
    for (let x = 0; x < w; x++) {
      let s = 0;
      for (let i = 0; i < 3; i++) {
        const cx = (i * 0.36 + 0.14) * w + Math.sin(this.t * 0.23 + i * 2.1) * w * 0.05;
        const d = (x - cx) / (w * 0.05);
        s += Math.exp(-d * d) * (0.55 + 0.45 * Math.sin(this.t * 0.8 + i * 1.7));
      }
      this.beam[x] = s * 0.42;
    }

    // 眨眼
    f.blinkIn -= dt;
    if (f.blinkIn <= 0) {
      f.blink = 0.15;
      f.blinkIn = 2.4 + rnd() * 4.5;
    }
    if (f.blink > 0) f.blink -= dt;
    if (f.mouth > 0) f.mouth -= dt;

    // 找最近的一颗食
    let target = null,
      best = 1e9;
    for (const p of this.pellets) {
      const d = Math.hypot(p.x - f.x, p.y - f.y);
      if (d < best) {
        best = d;
        target = p;
      }
    }

    // 游动
    f.wander -= dt;
    if (!target && f.wander <= 0) {
      f.wander = 2.2 + rnd() * 3.2;
      f.tx = 4 + rnd() * (w - 8);
      f.ty = h * 0.14 + rnd() * h * 0.55;
    }
    const tx = target ? target.x : f.tx;
    const ty = target ? target.y : f.ty;
    const dx = tx - f.x,
      dy = ty - f.y;
    const dist = Math.hypot(dx, dy) || 1;
    const topSpeed = target ? 34 : 12;
    const accel = target ? 5.0 : 1.4;
    const wob = Math.sin(this.t * 1.3 + f.phase) * (target ? 2.5 : 3.5);
    const dvx = (dx / dist) * topSpeed - (dy / dist) * wob;
    const dvy = (dy / dist) * topSpeed * 0.75 + (dx / dist) * wob;
    f.vx += (dvx - f.vx) * clamp01(accel * dt);
    f.vy += (dvy - f.vy) * clamp01(accel * dt);
    f.x += f.vx * dt;
    f.y += f.vy * dt;

    const rx = f.r * 1.2 * f.full;
    const margin = rx + 1.5;
    if (f.x < margin) {
      f.x = margin;
      f.vx = Math.abs(f.vx) * 0.4;
      f.tx = w * (0.6 + rnd() * 0.3);
    }
    if (f.x > w - margin) {
      f.x = w - margin;
      f.vx = -Math.abs(f.vx) * 0.4;
      f.tx = w * (0.1 + rnd() * 0.3);
    }
    if (f.y < f.r * 1.3) {
      f.y = f.r * 1.3;
      f.vy = Math.abs(f.vy) * 0.3;
      f.ty = h * (0.4 + rnd() * 0.4);
    }
    const floor = this.sandY[Math.floor(clamp(f.x, 0, w - 1))] - f.r * 1.0;
    if (f.y > floor) {
      f.y = floor;
      f.vy = -Math.abs(f.vy) * 0.3;
      f.ty = h * 0.35;
    }
    f.speed = Math.hypot(f.vx, f.vy);
    if (f.vx > 0.7) f.dir = 1;
    else if (f.vx < -0.7) f.dir = -1;

    // 吃东西
    for (let i = this.pellets.length - 1; i >= 0; i--) {
      const p = this.pellets[i];
      p.y += p.vy * dt;
      p.x += (p.vx + Math.sin(this.t * 1.7 + p.p) * 2.2) * dt;
      p.w += dt;
      if (Math.hypot(p.x - f.x, p.y - f.y) < f.r * 1.15) {
        this.pellets.splice(i, 1);
        this.fed++;
        f.full = Math.min(1.55, 1 + this.fed * 0.022);
        this.satiety = clamp01(this.satiety + 0.22);
        this.flash = 0.25;
        f.mouth = 0.22;
        this.burst(p.x, p.y, 5, "heart");
        this.burst(p.x, p.y, 3, "spark");
        for (let k = 0; k < 2; k++) {
          this.bubbles.push({
            x: p.x,
            y: p.y,
            v: 14,
            r: 0.5,
            p: rnd() * 6.28,
            a: 0.6,
          });
        }
        continue;
      }
      const sx = clamp(Math.floor(p.x), 0, w - 1);
      if (p.y > this.sandY[sx] - 1) {
        this.pellets.splice(i, 1);
        this.burst(p.x, this.sandY[sx] - 1, 3, "dust");
      }
    }

    // 气泡
    if (rnd() < dt * 3.2) this.spawnBubble(false);
    for (let i = this.bubbles.length - 1; i >= 0; i--) {
      const b = this.bubbles[i];
      b.y -= b.v * dt;
      b.x += Math.sin(this.t * 2 + b.p) * 0.6 * dt * 8;
      if (b.y < -2) this.bubbles.splice(i, 1);
    }

    // 粒子
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i];
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.kind === "heart") p.vy -= 6 * dt;
      else if (p.kind === "dust") p.vy += 30 * dt;
      else p.vy += 4 * dt;
      p.vx *= 0.97;
      if (p.life <= 0) this.parts.splice(i, 1);
    }

    // 远景小鱼
    for (const q of this.farFish) {
      q.x += q.v * dt;
      if (q.x < -4) q.x = this.w + 4;
      if (q.x > this.w + 4) q.x = -4;
    }

    // 浮游
    for (const q of this.plankton) {
      q.y += q.v * dt * 0.35;
      q.x += Math.sin(this.t * 0.5 + q.p) * dt * 2;
      if (q.y > h) {
        q.y = -1;
        q.x = rnd() * w;
      }
    }

    if (this.flash > 0) this.flash -= dt * 2.2;
    if (this.satiety > 0) this.satiety -= dt * 0.06;
  }

  feed() {
    const n = 2 + Math.floor(rnd() * 2);
    for (let i = 0; i < n; i++) this.spawnPellet();
    this.satiety = clamp01(this.satiety + 0.05);
  }

  toggleNight() {
    this.night = !this.night;
    this.buildBg();
  }

  // -------------------------------------------------------------- 绘制 ---
  buildDecor() {
    this.rocks = [];
    const n = this.w > 90 ? 3 : 2;
    for (let i = 0; i < n; i++) {
      this.rocks.push({
        x: 8 + rnd() * (this.w - 16),
        r: 1.6 + rnd() * 2.0,
        h: 1.2 + rnd() * 0.7,
      });
    }
    this.coral = [];
    for (let i = 0; i < 2; i++) {
      this.coral.push({
        x: 10 + rnd() * (this.w - 20),
        h: 5 + rnd() * 7,
        p: rnd() * 6.28,
      });
    }
    this.farFish = [];
    for (let i = 0; i < 3; i++) {
      this.farFish.push({
        x: rnd() * this.w,
        y: this.h * (0.16 + rnd() * 0.42),
        v: (rnd() < 0.5 ? -1 : 1) * (1.6 + rnd() * 2.6),
        p: rnd() * 6.28,
      });
    }
  }

  drawRocks() {
    const fb = this.fb;
    for (const k of this.rocks) {
      const baseY = this.sandY[Math.floor(clamp(k.x, 0, this.w - 1))] + 1;
      const rx = k.r * 2.3;
      for (let dx = -rx; dx <= rx; dx++) {
        const t = dx / rx;
        const hgt = Math.sqrt(Math.max(0, 1 - t * t)) * k.r * k.h;
        for (let dy = 0; dy < hgt; dy++) {
          const x = k.x + dx,
            y = baseY - dy;
          if (y < 0) continue;
          const up = 1 - dy / (hgt + 1);
          let c = mix(0x3b4557, 0x7e8798, 0.3 + 0.55 * up);
          c = mix(c, 0x232a36, Math.abs(t) * 0.6);
          c = mix(c, PAL.sand, 0.18 * up);
          fb.px(x, y, this.night ? shade(c, 0.5) : c);
        }
      }
    }
  }

  drawCoral() {
    const fb = this.fb;
    for (const c of this.coral) {
      const baseY = this.sandY[Math.floor(clamp(c.x, 0, this.w - 1))] + 1;
      for (let i = 0; i < c.h; i++) {
        const q = i / c.h;
        const x = c.x + Math.sin(this.t * 0.9 + c.p + q * 2.2) * q * 1.8;
        const y = baseY - i;
        if (y < 0) break;
        let col = mix(0xc44a72, 0xffa8c4, q * 0.9 + 0.1);
        if (this.night) col = shade(col, 0.55);
        fb.px(x, y, col);
        if (i % 3 === 0 && i > 2) fb.px(x + (i % 6 === 0 ? 1 : -1), y, shade(col, 0.75));
      }
    }
  }

  drawFarFish() {
    const fb = this.fb;
    for (const f of this.farFish) {
      const dir = f.v > 0 ? 1 : -1;
      const y = f.y + Math.sin(this.t * 0.8 + f.p) * 1.4;
      const col = this.night ? 0x3a5580 : 0x2f6e78;
      for (let i = 0; i < 3; i++) {
        fb.add(f.x + i * dir * 0.9, y, col, 0.42 - i * 0.07);
        fb.add(f.x + i * dir * 0.9, y + 0.7, col, 0.3 - i * 0.05);
      }
      fb.add(f.x - dir * 1.1, y + 0.3, col, 0.25);
    }
  }

  draw() {
    const fb = this.fb,
      w = this.w,
      h = this.h;
    const p = this.night ? PAL.night : PAL.day;

    // 水
    for (let y = 0; y < h; y++) {
      const row = y * w;
      const depth = clamp01(1 - y / (h * 1.05));
      const beamAmt = 0.16 + depth * 0.55;
      for (let x = 0; x < w; x++) {
        const c = this.bg[y];
        const b = this.beam[x] * beamAmt;
        fb.d[row + x] = b > 0.004 ? mix(c, p.beam, Math.min(0.5, b)) : c;
      }
    }

    // 水面波纹
    for (let x = 0; x < w; x++) {
      const y = 1 + Math.sin(x * 0.13 + this.t * 1.4) * 0.9;
      fb.add(x, y, this.night ? 0x9fc4ff : 0xd8fff6, 0.22);
      fb.add(x, y + 1, this.night ? 0x6f8fd0 : 0x8fd8cc, 0.1);
    }

    // 星星（夜里）
    if (this.night) {
      for (const s of this.stars) {
        const a = 0.18 + 0.5 * (0.5 + 0.5 * Math.sin(this.t * 1.6 + s.p)) * s.s;
        fb.add(s.x, s.y, PAL.star, a * 0.8);
      }
    }

    // 浮游生物
    for (const q of this.plankton) {
      fb.add(q.x, q.y, this.night ? PAL.star : PAL.bubble, q.a * (this.night ? 1.3 : 0.7));
    }

    // 沙底
    this.drawSand();
    this.drawRocks();
    this.drawCoral();

    // 水草
    this.drawKelp();

    // 远处的小鱼
    this.drawFarFish();

    // 气泡
    for (const b of this.bubbles) {
      const a = b.a;
      fb.add(b.x, b.y, PAL.bubble, a * 0.9);
      if (b.r > 0.7) {
        fb.add(b.x - 0.6, b.y - 0.6, PAL.bubble, a * 0.5);
        fb.add(b.x + 0.6, b.y + 0.6, shade(PAL.bubble, 0.6), a * 0.35);
      }
    }

    // 鱼食
    for (const q of this.pellets) {
      const tw = 0.7 + 0.3 * Math.sin(this.t * 6 + q.p);
      fb.add(q.x, q.y, PAL.pelletGlow, 0.25 * tw);
      fb.px(q.x, q.y, PAL.pellet);
      fb.px(Math.round(q.x), Math.round(q.y), mix(PAL.pellet, 0xffffff, tw * 0.4));
    }

    // 主鱼
    this.drawFish();

    // 粒子
    for (const q of this.parts) {
      const a = clamp01(q.life * 2.2);
      if (q.kind === "heart") {
        const c = mix(PAL.heart, 0xffffff, 0.3);
        fb.add(q.x, q.y, c, a);
        fb.add(q.x - 1, q.y, c, a * 0.8);
        fb.add(q.x + 1, q.y, c, a * 0.8);
        fb.add(q.x, q.y - 1, c, a * 0.8);
      } else if (q.kind === "spark") {
        fb.add(q.x, q.y, 0xfff6d0, a);
      } else {
        fb.add(q.x, q.y, PAL.sandLit, a * 0.7);
      }
    }

    // 暗角：让视线落在中间
    for (let y = 0; y < h; y++) {
      const dy = (y - h * 0.52) / h;
      const row = y * w;
      for (let x = 0; x < w; x++) {
        const dx = (x - w * 0.5) / w;
        const d = dx * dx * 1.1 + dy * dy * 1.3;
        const k = 1 - 0.5 * Math.min(1, d * 2.3);
        if (k < 0.999) fb.d[row + x] = shade(fb.d[row + x], k);
      }
    }

    // 吃到的瞬间，水整体亮一点点
    if (this.flash > 0) {
      const a = this.flash * 0.10;
      for (let i = 0; i < fb.d.length; i++) fb.d[i] = mix(fb.d[i], 0xfff6dd, a);
    }
  }

  drawSand() {
    const fb = this.fb,
      w = this.w,
      h = this.h;
    for (let x = 0; x < w; x++) {
      const top = this.sandY[x];
      for (let y = top; y < h; y++) {
        const d = (y - top) / Math.max(1, h - top);
        let c = mix(PAL.sandLit, PAL.sand, smooth(0, 0.45, d));
        c = mix(c, PAL.sandDark, smooth(0.45, 1, d) * 0.85);
        const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
        const f = n - Math.floor(n);
        c = shade(c, 0.9 + f * 0.22);
        if (y === top) c = mix(c, PAL.sandLit, 0.55);
        fb.px(x, y, this.night ? shade(c, 0.5) : c);
      }
      // 小石子
      if (x % 13 === 5) {
        const y0 = top + 1;
        for (let k = 0; k < 2; k++) fb.px(x, y0 + k, mix(PAL.sandDark, 0x3a3a44, 0.4));
      }
    }
  }

  drawKelp() {
    const fb = this.fb;
    for (const k of this.kelp) {
      const seg = Math.round(k.h);
      const baseY = this.sandY[Math.floor(clamp(k.x, 0, this.w - 1))];
      let prevX = k.x;
      for (let i = 0; i < seg; i++) {
        const q = i / seg;
        const sway = Math.sin(this.t * k.sp + k.p + q * 2.2) * (0.6 + q * 2.2) + k.lean * q;
        const x = k.x + sway;
        const y = baseY - i;
        if (y < 0) break;
        const step = Math.max(1, Math.ceil(Math.abs(x - prevX)));
        let c = mix(PAL.kelpC, mix(PAL.kelpA, PAL.kelpB, 0.3 + k.shade * 0.55), q);
        if (this.night) c = shade(c, 0.55);
        for (let si = 0; si < step; si++) {
          const xx = prevX + ((x - prevX) * si) / step;
          fb.px(xx, y, c);
          if (k.thick > 1) fb.px(xx + 1, y, shade(c, 0.55));
        }
        prevX = x;
        // 叶片：交错长在两侧，让水草看起来是"一株"而不是一根线
        if (q > 0.18 && i % 3 === 0) {
          const leaf = i % 6 === 0 ? 1 : -1;
          const lc = this.night ? shade(0x3f9a6d, 0.6) : mix(PAL.kelpA, PAL.kelpB, 0.55 + q * 0.35);
          fb.px(x + leaf, y, lc);
          fb.px(x + leaf * 2, y - (leaf > 0 ? 1 : 0), shade(lc, 0.8));
          if (q > 0.5) fb.px(x + leaf * 2, y, shade(lc, 0.85));
        }
      }
    }
  }
  drawFish() {
    const fb = this.fb,
      f = this.fish;
    const r = f.r * f.full;
    const pulse = 1 + 0.028 * Math.sin(this.t * 2.0 + f.phase);
    const rx = r * 1.5;
    const ry = r * 0.98 * pulse;
    const ang = clamp(f.vy * 0.05, -0.3, 0.3) * f.dir;
    const ca = Math.cos(ang),
      sa = Math.sin(ang);
    const dir = f.dir;
    const beat = 3.6 + Math.min(6, f.speed * 0.5);
    const wig = Math.sin(this.t * beat + f.phase);
    const tailLen = rx * 0.92;
    const blink = f.blink > 0;
    const open = f.mouth > 0;

    const x0 = Math.floor(f.x - rx * 2.4),
      x1 = Math.ceil(f.x + rx * 2.2);
    const y0 = Math.floor(f.y - ry * 1.9),
      y1 = Math.ceil(f.y + ry * 1.9);

    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const dx = x + 0.5 - f.x,
          dy = y + 0.5 - f.y;
        const u = (dx * ca + dy * sa) * dir;
        const v = -dx * sa + dy * ca;

        let col = 0,
          alpha = 0;
        const paint = (c, a) => {
          if (a <= 0) return;
          if (alpha <= 0) {
            col = c;
            alpha = a;
          } else {
            const na = Math.min(1, alpha + a);
            col = mix(col, c, a / na);
            alpha = na;
          }
        };

        // 身体轮廓：后段收窄，前段略鼓
        const back01 = clamp01((-u / rx - 0.15) / 0.85);
        const ryU = ry * (1 - 0.32 * back01) * (1 + 0.06 * clamp01((u / rx - 0.25) / 0.75));
        const eu = u / rx,
          ev = v / Math.max(0.8, ryU);
        const d2 = eu * eu + ev * ev;

        // ---- 尾巴（先画，身体盖住根部）
        const b = -u - rx * 0.7;
        if (b >= 0 && b <= tailLen) {
          const k = b / tailLen;
          const wave = Math.sin(this.t * beat + f.phase - k * 2.6);
          const H = ry * 1.0;
          const half = H * (0.5 + 0.5 * k) * (0.94 + 0.06 * wave);
          const vc = -wave * H * 0.22 * k;
          const dv = Math.abs(v - vc);
          const notch = H * 0.42 * smooth(0.45, 1, k);
          if (dv <= half && dv > notch) {
            const e = dv / Math.max(0.4, half);
            let c = mix(PAL.fishFin, PAL.fishFinEdge, 0.15 + 0.7 * e);
            c = mix(c, 0xffffff, 0.12 * (1 - e) * k);
            const a = clamp01((half - dv) * 1.8) * clamp01((tailLen - b) * 2 + 0.2);
            paint(c, a * 0.96);
          }
        }

        // ---- 背鳍
        const ds = (u + rx * 0.25) / (rx * 0.45);
        const dt2 = (v + ryU * 1.02 + wig * 0.6) / (ryU * 0.42);
        const dfin = ds * ds + dt2 * dt2;
        if (dfin <= 1 && v < 0) {
          paint(mix(PAL.fishFin, PAL.fishFinEdge, 0.55), clamp01((1 - dfin) * 2.4) * 0.85);
        }

        // ---- 身体
        if (d2 <= 1.1) {
          const a = clamp01((1.1 - d2) / 0.14);
          const vt = clamp01(ev * 0.5 + 0.5);
          let c = mix(PAL.fishTop, PAL.fishBelly, smooth(0.15, 0.95, vt));
          c = mix(c, PAL.fishMid, 0.3);
          c = mix(c, PAL.fishRim, clamp01((-ev - 0.3) / 0.7) * 0.5);
          c = mix(c, PAL.fishRim, smooth(0.7, 1.06, d2) * 0.6);
          const sp = Math.exp(-(((eu + 0.18) ** 2) * 7 + ((ev + 0.52) ** 2) * 16));
          c = mix(c, 0xfff6de, clamp01(sp) * 0.55);
          paint(c, a);
        }

        // ---- 胸鳍
        const flap = Math.sin(this.t * 5.5 + f.phase);
        const pfu = (u - rx * 0.05) / (rx * 0.3);
        const pfv = (v - ryU * (0.52 + 0.08 * flap)) / (ryU * (0.3 + 0.05 * flap));
        const pf = pfu * pfu + pfv * pfv;
        if (pf <= 1.05) {
          paint(mix(PAL.fishFin, 0xffd0a0, 0.35), clamp01((1.05 - pf) * 2.6) * 0.75);
        }

        // ---- 腮红
        const bu = (u - rx * 0.6) / (rx * 0.3),
          bv = (v - ryU * 0.34) / (ryU * 0.26);
        if (bu * bu + bv * bv <= 1) paint(PAL.blush, 0.2);

        // ---- 眼睛
        const eyu = rx * 0.42,
          eyv = -ryU * 0.2,
          er = Math.max(1.6, ry * 0.36);
        const edx = (u - eyu) / er,
          edy = (v - eyv) / er;
        const ed = edx * edx + edy * edy;
        if (ed <= 1.2) {
          if (blink) {
            if (Math.abs(v - eyv) <= Math.max(0.7, er * 0.2) && Math.abs(u - eyu) <= er * 0.95)
              paint(PAL.eyeDark, 0.95);
          } else {
            paint(0xfff1dc, clamp01((1.2 - ed) * 3));
            const px2 = (u - (eyu + er * 0.2)) / (er * 0.74);
            const py2 = (v - (eyv + er * 0.08)) / (er * 0.8);
            const pd = px2 * px2 + py2 * py2;
            if (pd <= 1) paint(PAL.eyeDark, clamp01((1 - pd) * 3));
            const hx = (u - (eyu - er * 0.08)) / (er * 0.25);
            const hy = (v - (eyv - er * 0.36)) / (er * 0.25);
            if (hx * hx + hy * hy <= 1) paint(0xffffff, 0.95);
          }
        }

        // ---- 嘴（嘴角微微上扬）
        const mu = u - rx * 0.9;
        if (mu > -2.4 && mu < 2.2) {
          const mv = v - (ryU * 0.1 + 0.22 * mu * mu);
          if (Math.abs(mv) < (open ? 1.1 : 0.55)) paint(PAL.mouth, 0.82);
        }

        if (alpha > 0) fb.add(x, y, col, alpha);
      }
    }
  }
}

// ------------------------------------------------------------- 终端输出 ---
function renderANSI(cv) {
  const { w, h } = cv;
  const rows = h >> 1;
  let out = "\x1b[?2026h";
  let cf = -1,
    cb = -1;
  for (let cy = 0; cy < rows; cy++) {
    out += "\x1b[" + (cy + 1) + ";1H";
    const a = (cy * 2) * w,
      b = (cy * 2 + 1) * w;
    for (let x = 0; x < w; x++) {
      const top = cv.d[a + x],
        bot = cv.d[b + x];
      if (top !== cf) {
        out += "\x1b[38;2;" + ((top >> 16) & 255) + ";" + ((top >> 8) & 255) + ";" + (top & 255) + "m";
        cf = top;
      }
      if (bot !== cb) {
        out += "\x1b[48;2;" + ((bot >> 16) & 255) + ";" + ((bot >> 8) & 255) + ";" + (bot & 255) + "m";
        cb = bot;
      }
      out += "\u2580";
    }
    out += "\x1b[0m";
    cf = -1;
    cb = -1;
  }
  out += "\x1b[?2026l";
  return out;
}

const MOODS = [
  [0, "有点饿"],
  [3, "挺开心"],
  [8, "超满足"],
  [15, "圆滚滚"],
];
function moodOf(fed) {
  let m = MOODS[0][1];
  for (const [n, s] of MOODS) if (fed >= n) m = s;
  return m;
}

function renderHUD(world, w, row) {
  const fed = world.fed;
  const sat = Math.round(clamp01(world.satiety) * 100);
  const barW = 8;
  const filled = Math.round((clamp01(world.satiety) * barW) | 0);
  const bar =
    "\x1b[38;2;255;207;92m" + "\u2588".repeat(filled) + "\x1b[38;2;60;80;90m" +
    "\u2591".repeat(Math.max(0, barW - filled)) + "\x1b[0m";

  const left =
    " \x1b[38;2;255;152;64m~ \u5927\u80a5\u9c7c\x1b[0m" +
    " \x1b[38;2;90;120;130m\u00b7\x1b[0m " +
    "\u5df2\u5403 \x1b[1;38;2;255;220;150m" + fed + "\x1b[0m \u9897" +
    " \x1b[38;2;90;120;130m\u00b7\x1b[0m " +
    "\u5fc3\u60c5 \x1b[38;2;160;230;200m" + moodOf(fed) + "\x1b[0m" +
    " \x1b[38;2;90;120;130m\u00b7\x1b[0m \u9971\u8179 " + bar + " " +
    "\x1b[38;2;120;150;160m" + sat + "%\x1b[0m";
  const right =
    "\x1b[38;2;110;140;150m[\u7a7a\u683c] \u5582\u98df   [N] \u663c\u591c   [Q] \u9000\u51fa\x1b[0m ";

  const lw = dispWidth(stripAnsi(left));
  const rw = dispWidth(stripAnsi(right));
  const pad = Math.max(1, w - lw - rw);
  let line = left + " ".repeat(pad) + right;
  if (w < 44) line = "\x1b[38;2;255;152;64m~ \u5927\u80a5\u9c7c\x1b[0m \x1b[0m";
  return "\x1b[" + row + ";1H\x1b[0m" + line + "\x1b[K";
}
function stripAnsi(s) {
  return s.replace(/\x1b\[[0-9;?]*[a-zA-Z]/g, "");
}

// ------------------------------------------------------------------ 录制 ---
function require_dirname(p) {
  const i = Math.max(p.lastIndexOf("/"), p.lastIndexOf("\\"));
  return i > 0 ? p.slice(0, i) : ".";
}
function record(world, frames, base, fps) {
  const { w, h } = world;
  const buf = Buffer.alloc(w * h * 3 * frames);
  const dt = 1 / fps;
  const script = [
    [Math.round(frames * 0.1), "feed"],
    [Math.round(frames * 0.3), "feed"],
    [Math.round(frames * 0.46), "feed"],
    [Math.round(frames * 0.6), "night"],
    [Math.round(frames * 0.8), "night"],
    [Math.round(frames * 0.88), "feed"],
  ];
  let si = 0;
  for (let i = 0; i < frames; i++) {
    for (; si < script.length && script[si][0] === i; si++) {
      const act = script[si][1];
      if (act === "feed") world.feed();
      else if (act === "night") world.toggleNight();
    }
    world.update(dt);
    world.draw();
    let o = i * w * h * 3;
    for (let k = 0; k < w * h; k++) {
      const c = world.fb.d[k];
      buf[o++] = (c >> 16) & 255;
      buf[o++] = (c >> 8) & 255;
      buf[o++] = c & 255;
    }
  }
  fs.mkdirSync(require_dirname(base), { recursive: true });
  fs.writeFileSync(base + ".bin", buf);
  fs.writeFileSync(
    base + ".json",
    JSON.stringify({ w, h, fps, frames, night: world.night, seed: opt.seed })
  );
  console.log("recorded " + frames + " frames -> " + base + ".bin / .json  (" + w + "x" + h + ")");
}

// ------------------------------------------------------------------ 主循环 ---
function main() {
  const isTTY = process.stdout.isTTY && !opt.record;
  let cols = opt.width || (isTTY ? process.stdout.columns : 100) || 100;
  let rows = opt.height || (isTTY ? process.stdout.rows : 30) || 30;
  let hudRows = opt.hud && !opt.record ? 1 : 0;

  const makeWorld = (w, h) => new World(w, Math.max(8, (h >> 1) << 1));

  if (opt.record) {
    const w = opt.width || 104;
    const h = opt.height || 64;
    const world = makeWorld(w, h);
    record(world, opt.frames, opt.record, opt.fps);
    return;
  }

  if (opt.once) {
    const w = opt.width || 100;
    const rows = opt.height || 30;
    const hud = opt.hud ? 1 : 0;
    const world = makeWorld(w, rows - hud);
    for (let i = 0; i < 45; i++) world.update(1 / 30);
    world.draw();
    let out = renderANSI(world.fb);
    if (hud) out += "\n" + renderHUD(world, w, rows - hud + 1);
    process.stdout.write(out + "\n");
    return;
  }

  // 没有终端就别硬放动画了
  if (!process.stdout.isTTY && !opt.once && !opt.record) {
    console.log("大肥鱼需要一个真的终端才能游起来。");
    console.log("  在终端里运行：  npx github:qpzmas/siokhfd");
    console.log("  只想看一帧：    fatfish --once");
    process.exit(1);
  }

  // 交互模式
  let canvasRows = Math.max(10, rows - hudRows);
  let world = makeWorld(cols, canvasRows);

  const out = (s) => process.stdout.write(s);
  out("\x1b[?1049h\x1b[?25l\x1b[2J\x1b[H");

  let running = true;
  let raf = null;

  const cleanup = () => {
    if (!running) return;
    running = false;
    if (raf) clearTimeout(raf);
    try {
      process.stdin.setRawMode(false);
    } catch {}
    try {
      fs.writeSync(1, "\x1b[0m\x1b[?25h\x1b[?1049l");
    } catch {}
    if (process.stdin.isTTY) process.stdin.pause();
  };
  const quit = () => {
    cleanup();
    process.exit(0);
  };

  const onKey = (buf) => {
    const s = buf.toString();
    for (const ch of s) {
      if (ch === "\u0003" || ch === "\u001b" || ch === "q" || ch === "Q") return quit();
      if (ch === " ") {
        world.feed();
        return;
      }
      if (ch === "f" || ch === "F") {
        world.feed();
        return;
      }
      if (ch === "n" || ch === "N") {
        world.toggleNight();
        return;
      }
      if (ch === "r" || ch === "R") {
        world = makeWorld(cols, canvasRows);
        return;
      }
    }
  };

  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", onKey);
  }
  process.on("SIGINT", () => {
    cleanup();
    process.exit(0);
  });
  process.on("exit", cleanup);
  process.on("uncaughtException", (e) => {
    cleanup();
    console.error(e);
    process.exit(1);
  });

  process.stdout.on("resize", () => {
    cols = process.stdout.columns || cols;
    rows = process.stdout.rows || rows;
    canvasRows = Math.max(10, rows - hudRows);
    world = makeWorld(cols, canvasRows);
    out("\x1b[2J");
  });

  let last = Date.now();
  const step = () => {
    if (!running) return;
    const now = Date.now();
    const dt = Math.min(0.06, (now - last) / 1000);
    last = now;
    if (cols < 24 || canvasRows < 8) {
      out("\x1b[H\x1b[2J\u7a97\u53e3\u592a\u5c0f\u4e86\uff0c\u62c9\u5927\u4e00\u70b9\u5427 \xff5e q \u9000\u51fa");
    } else {
      world.update(dt);
      world.draw();
      let frame = renderANSI(world.fb);
      if (opt.hud) frame += renderHUD(world, cols, canvasRows + 1);
      out(frame);
    }
    raf = setTimeout(step, Math.max(8, Math.round(1000 / opt.fps)));
  };
  step();
}

main();
