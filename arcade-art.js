import { HOUSES, WORLD_TREES, roomExhibits, interactTown } from "./arcade-core.js";

const T = 24, sprites = new Map();
const art = { scenery: [], actors: [], props: [], room: null, meadow: null };
let artPromise;

export function canvasMetrics(width, height, ratio = 1) {
  const scale = Math.max(1, Math.min(2, ratio || 1));
  return { width: Math.round(width * scale), height: Math.round(height * scale), scale };
}

// Remove only the neutral backdrop connected to cell edges, not pale sprite details.
export function matteSprite(data, width, height, cutouts = false) {
  const visited = new Uint8Array(width * height), queue = new Int32Array(width * height);
  let head = 0, tail = 0;
  const add = i => {
    if (visited[i]) return;
    visited[i] = 1;
    const p = i * 4, min = Math.min(data[p], data[p + 1], data[p + 2]), max = Math.max(data[p], data[p + 1], data[p + 2]);
    if (min > 225 && max - min < 18) { data[p + 3] = 0; queue[tail++] = i; }
  };
  for (let x = 0; x < width; x++) { add(x); add((height - 1) * width + x); }
  for (let y = 0; y < height; y++) { add(y * width); add(y * width + width - 1); }
  while (head < tail) {
    const i = queue[head++], x = i % width;
    if (x) add(i - 1); if (x < width - 1) add(i + 1);
    if (i >= width) add(i - width); if (i < width * (height - 1)) add(i + width);
  }
  if (cutouts) for (let p = 0; p < data.length; p += 4) {
    const min = Math.min(data[p], data[p + 1], data[p + 2]), max = Math.max(data[p], data[p + 1], data[p + 2]);
    if (min > 230 && max - min < 14) data[p + 3] = 0;
  }
  return data;
}

function atlasCells(image, columns, rows, cutouts = false) {
  const w = image.naturalWidth / columns, h = image.naturalHeight / rows;
  return Array.from({ length: columns * rows }, (_, i) => {
    const c = document.createElement("canvas"); c.width = w; c.height = h;
    const ctx = c.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(image, i % columns * w, Math.floor(i / columns) * h, w, h, 0, 0, w, h);
    const pixels = ctx.getImageData(0, 0, w, h); matteSprite(pixels.data, w, h, cutouts); ctx.putImageData(pixels, 0, 0);
    let left = w, right = 0, top = h, bottom = 0;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (pixels.data[(y * w + x) * 4 + 3] > 32) {
      left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y);
    }
    return { image: c, x: left, y: top, w: Math.max(1, right - left + 1), h: Math.max(1, bottom - top + 1) };
  });
}

export function loadTownArt() {
  if (!artPromise) {
    const load = name => new Promise((resolve, reject) => {
      const img = new Image(); img.onload = () => resolve(img); img.onerror = () => reject(new Error("小镇美术素材加载失败")); img.src = new URL(`assets/${name}`, import.meta.url).href;
    });
    artPromise = Promise.all([load("town-scenery-v2.png"), load("town-actors-v2.png"), load("town-room-v2.png"), load("town-meadow-v2.png"), load("town-props-v2.png")]).then(([scenery, actors, room, meadow, props]) => {
      art.scenery = atlasCells(scenery, 3, 2, true); art.actors = atlasCells(actors, 4, 2); art.props = atlasCells(props, 3, 2, true); art.room = room; art.meadow = meadow;
    }).catch(error => { artPromise = null; throw error; });
  }
  return artPromise;
}

function sprite(c, item, x, foot, width, height) {
  if (!item) return false;
  c.drawImage(item.image, item.x, item.y, item.w, item.h, x - width / 2, foot - height, width, height);
  return true;
}
const clamp = (v, low, high) => Math.max(low, Math.min(high, v));
const noise = (x, y, seed = 0) => {
  let n = Math.imul(x + seed * 71, 374761393) + Math.imul(y + seed * 13, 668265263);
  n = Math.imul(n ^ n >>> 13, 1274126177); return ((n ^ n >>> 16) >>> 0) / 4294967295;
};
const box = (c, x, y, w, h, color) => { c.fillStyle = color; c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
function label(c, text, x, y, size = 9, color = "#fff0b6") {
  c.font = `bold ${size}px "PingFang SC", monospace`; c.textAlign = "center";
  c.fillStyle = "#4b392bbb"; c.fillText(text, Math.round(x) + 1, Math.round(y) + 1);
  c.fillStyle = color; c.fillText(text, Math.round(x), Math.round(y));
}
function cached(key, width, height, paint) {
  if (!sprites.has(key)) {
    const canvas = document.createElement("canvas"); canvas.width = width; canvas.height = height;
    paint(canvas.getContext("2d")); sprites.set(key, canvas);
  }
  return sprites.get(key);
}
function oval(c, x, y, rx, ry, color) {
  c.fillStyle = color; c.beginPath(); c.ellipse(Math.round(x), Math.round(y), rx, ry, 0, 0, Math.PI * 2); c.fill();
}
function polygon(c, points, color) {
  c.fillStyle = color; c.beginPath(); points.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.closePath(); c.fill();
}
function treeImage(variant = 0) {
  return cached(`tree-${variant}`, 76, 98, c => {
    oval(c, 38, 88, 29, 8, "#35462045");
    box(c, 32, 51, 13, 38, "#65472e"); box(c, 34, 52, 5, 32, "#997042"); box(c, 30, 83, 20, 5, "#75512d"); box(c, 38, 69, 3, 16, "#4c3928");
    polygon(c, [[35, 71], [23, 52], [29, 51], [40, 67]], "#795534");
    [[38, 21, 20], [21, 37, 20], [51, 37, 19], [32, 49, 26], [45, 59, 19], [19, 57, 14]].forEach(([x, y, r]) => {
      for (let py = -r; py <= r; py += 3) for (let px = -r; px <= r; px += 3) {
        const v = noise(x + px, y + py, variant + 2);
        if (px * px / (r * r) + py * py / (r * r * .68) > 1 + v * .12) continue;
        const light = (-px - py) / r + v * 1.3;
        const shades = variant === 2 ? ["#496236", "#618445", "#81a454", "#a8bb67", "#b9c976"] : ["#2f572f", "#3f7534", "#579638", "#79b943", "#9acd51"];
        box(c, x + px, y + py, 4, 3, shades[clamp(Math.floor(light + 1), 0, 4)]);
        if (v > .8) box(c, x + px, y + py - 1, 3, 1, "#b9d96b");
      }
    });
    if (variant === 1) [[18, 42], [44, 28], [54, 49], [35, 62]].forEach(([x, y]) => {
      box(c, x, y, 5, 5, "#bf663e"); box(c, x + 1, y, 3, 2, "#f3bd56"); box(c, x + 2, y - 2, 1, 2, "#3b542f");
    });
  });
}
function flowerPot(c, x, y, kind = 0) {
  oval(c, x + 6, y + 15, 9, 3, "#44392344");
  box(c, x, y + 5, 12, 3, "#d29157"); box(c, x + 2, y + 8, 8, 7, "#af6542"); box(c, x + 3, y + 8, 2, 6, "#d39157");
  for (let i = 0; i < 5; i++) {
    const dx = x + i * 3 - 1, dy = y - 5 + (i % 2) * 5;
    box(c, dx + 1, dy + 2, 2, 8, "#427339"); box(c, dx - 1, dy, 5, 4, kind ? "#efd96f" : "#c587b9"); box(c, dx, dy, 2, 2, "#ffe7c6");
  }
}
function houseImage(h, index) {
  return cached(`cottage-${h.id}`, 148, 146, c => {
    const roof = [["#703d31", "#a6553b", "#ca7545", "#e29a5d"], ["#354d60", "#4c7282", "#6f9298", "#91b3ac"], ["#674153", "#905b70", "#b17c8b", "#d4a094"]][index];
    oval(c, 77, 127, 69, 9, "#3d432e44"); box(c, 18, 49, 113, 70, "#795131");
    for (let x = 21; x < 131; x += 9) {
      box(c, x, 52, 7, 63, x % 2 ? "#c99459" : "#d9ab6b"); box(c, x + 1, 56, 1, 54, "#efc381"); box(c, x + 5, 73 + x % 11, 1, 20, "#b7814e"); box(c, x + 3, 60 + x % 19, 2, 2, "#aa7646");
    }
    box(c, 16, 114, 117, 8, "#736452");
    for (let x = 18; x < 133; x += 12) { box(c, x, 115, 10, 4, "#aaa07c"); box(c, x + 2, 120, 8, 2, "#8b836b"); }
    box(c, 112, 11, 15, 27, "#8b5c46");
    for (let y = 12; y < 35; y += 6) { box(c, 114, y, 10, 1, "#c38967"); box(c, 119, y, 1, 5, "#6b4a3a"); }
    box(c, 110, 9, 19, 5, "#bb8060");
    const points = [[10, 55], [33, 15], [108, 15], [140, 55], [140, 61], [10, 61]];
    c.save(); polygon(c, points, roof[0]); c.clip();
    for (let y = 18; y < 59; y += 7) for (let x = -2 + (y % 2) * 7; x < 150; x += 14) {
      box(c, x, y, 13, 6, roof[noise(x, y, index) > .7 ? 2 : 1]); box(c, x + 1, y, 12, 1, roof[3]); box(c, x + 12, y + 1, 1, 5, roof[0]);
    }
    c.restore(); box(c, 9, 57, 132, 5, roof[0]); box(c, 17, 61, 114, 5, "#5a3c2c88");
    polygon(c, [[56, 48], [74, 25], [94, 48]], roof[0]); polygon(c, [[60, 47], [74, 29], [89, 47]], "#e2b678");
    box(c, 69, 36, 11, 11, "#4a656b"); box(c, 70, 37, 4, 4, "#a7cfcc"); box(c, 74, 36, 1, 11, "#cfb181");
    for (const x of [29, 103]) {
      box(c, x - 4, 71, 27, 26, "#67523b"); box(c, x, 72, 19, 21, "#547a88"); box(c, x + 2, 73, 7, 7, "#b6d6cc"); box(c, x + 11, 83, 6, 7, "#8db6b6");
      box(c, x + 9, 72, 2, 22, "#ead3a3"); box(c, x, 81, 19, 2, "#e0c899"); box(c, x - 7, 71, 5, 24, "#637d4a"); box(c, x + 21, 71, 5, 24, "#657f4d");
      for (let y = 74; y < 94; y += 5) { box(c, x - 6, y, 3, 1, "#9aae69"); box(c, x + 22, y, 3, 1, "#9aae69"); }
      box(c, x - 4, 96, 28, 3, "#e4c38a");
    }
    box(c, 63, 83, 25, 36, "#6c472e"); box(c, 66, 85, 19, 31, "#a27346"); box(c, 68, 87, 14, 10, "#72959a"); box(c, 69, 88, 6, 3, "#b4d0bd");
    box(c, 68, 100, 14, 12, "#b58a54"); box(c, 79, 101, 3, 3, "#ead295");
    box(c, 47, 117, 54, 5, "#b17c47"); box(c, 44, 122, 60, 4, "#d0a065"); box(c, 41, 126, 66, 4, "#997044");
    box(c, 54, 65, 46, 12, "#6b4834"); box(c, 56, 66, 42, 1, "#b1884d"); label(c, h.name, 77, 74, 8, "#ffe0a0");
    flowerPot(c, 20, 110, index % 2); flowerPot(c, 121, 109, 1); box(c, 89, 82, 4, 12, "#543e2b"); box(c, 89, 83, 4, 6, "#f6d990");
    for (let i = 0; i < 6; i++) { const x = 26 + i % 3 * 6, y = 104 + Math.floor(i / 3) * 5; box(c, x, y, 6, 4, "#704a31"); box(c, x + 1, y, 3, 3, "#bd9561"); }
  });
}
function onPath(x, y) {
  return (y >= 10 && y < 12 && x >= 2 && x < 28) || (x === 5 && y >= 8 && y < 11) || (x === 14 && y >= 7 && y < 12) || (x === 24 && y >= 8 && y < 15) || (x === 7 && y >= 11 && y < 15) || (x >= 13 && x < 17 && y >= 10 && y < 13);
}
function groundImage() {
  return cached(art.meadow ? "meadow-v2" : "meadow", 1440, 864, c => {
    c.scale(2, 2);
    const meadow = c.createLinearGradient(0, 0, 600, 432); meadow.addColorStop(0, "#b5c47d"); meadow.addColorStop(.5, "#91ac68"); meadow.addColorStop(1, "#779660");
    c.fillStyle = meadow; c.fillRect(0, 0, 720, 432);
    for (let i = 0; i < 95; i++) {
      const x = noise(i, 2) * 720, y = noise(i, 4) * 432, r = 15 + noise(i, 7) * 30;
      const glow = c.createRadialGradient(x, y, 0, x, y, r); glow.addColorStop(0, i % 2 ? "#dce5a426" : "#537f4920"); glow.addColorStop(1, "#92b37100");
      c.fillStyle = glow; c.fillRect(x - r, y - r, r * 2, r * 2);
    }
    if (art.meadow) c.drawImage(art.meadow, 0, 0, 720, 432);
    const lanes = [[[72, 264], [648, 264], 39], [[132, 200], [132, 264], 19], [[348, 177], [348, 264], 21], [[588, 200], [588, 354], 22], [[180, 264], [180, 354], 23]];
    c.lineCap = "round"; c.lineJoin = "round";
    for (const edge of [true, false]) lanes.forEach(([a, b, width]) => {
      c.strokeStyle = edge ? "#8f956849" : "#d8c397"; c.lineWidth = width + (edge ? 5 : 0);
      c.beginPath(); c.moveTo(...a); c.lineTo(...b); c.stroke();
    });
    c.save(); c.beginPath(); lanes.forEach(([a, b, width]) => c.rect(Math.min(a[0], b[0]) - width / 2 + 3, Math.min(a[1], b[1]) - width / 2 + 3, Math.abs(a[0] - b[0]) + width - 6, Math.abs(a[1] - b[1]) + width - 6)); c.clip();
    for (let i = 0; i < 2600; i++) { const x = noise(i, 3) * 720, y = noise(i, 9) * 432; oval(c, x, y, .4 + noise(i, 7) * .6, .3, i % 2 ? "#ad977033" : "#fff1ca4d"); }
    c.restore();
    for (let i = 0; i < 290; i++) {
      const x = Math.floor(noise(i, 3) * 720), y = Math.floor(noise(i, 7) * 432);
      if (onPath(Math.floor(x / T), Math.floor(y / T))) { if (i % 8 === 0) { box(c, x, y, 3, 2, "#b3966a"); box(c, x, y - 1, 2, 1, "#efcf94"); } continue; }
      box(c, x, y, .5, 2, "#63885066"); box(c, x - 1.5, y - 1, .5, 2, "#72955a66"); box(c, x + 1.5, y - 1, .5, 3, "#d0d99a88");
      if (i % 12 === 0) { box(c, x - 1, y - 4, 4, 3, i % 24 ? "#e7a1b3" : "#f6e1a1"); box(c, x, y - 4, 1, 1, "#fff3c0"); }
    }
    c.beginPath(); c.roundRect(404, 308, 104, 103, 18); c.fillStyle = "#707e5577"; c.fill();
    c.beginPath(); c.roundRect(409, 313, 94, 93, 15);
    const water = c.createLinearGradient(409, 313, 490, 409); water.addColorStop(0, "#466f72"); water.addColorStop(.42, "#6faba9"); water.addColorStop(1, "#91bdac"); c.fillStyle = water; c.fill();
    c.strokeStyle = "#d2d5a27a"; c.lineWidth = 1.5; c.stroke();
    for (let i = 0; i < 11; i++) oval(c, 414 + i * 8, 404 + Math.sin(i) * 3, 3.5, 2, i % 2 ? "#99a68a" : "#bac1a0");
    for (let i = 0; i < 24; i++) { const x = 403 + i % 2 * 105, y = 313 + Math.floor(i / 2) * 8; box(c, x, y, 3, 8, "#6c9a44"); box(c, x + 3, y - 3, 1, 10, "#b2c064"); }
    for (const [cx, cy] of [[7, 14], [24, 14]]) {
      for (let i = 0; i < 120; i++) box(c, cx * T + (noise(i, cx) - .5) * 65, cy * T + (noise(i, cy) - .5) * 41 + 14, 2, 1, "#b1ac69");
      for (let x = cx * T - 39; x < cx * T + 61; x += 18) { box(c, x, 389, 19, 3, "#825831"); box(c, x, 380, 19, 3, "#b68a4b"); box(c, x, 375, 4, 24, "#946636"); box(c, x, 375, 3, 2, "#d2ad6b"); }
    }
    for (let y = 6; y < 9; y++) for (let x = 1; x < 3; x++) {
      box(c, x * T + 4, y * T + 7, 17, 10, "#967044");
      for (let k = 0; k < 3; k++) { box(c, x * T + 7 + k * 5, y * T + 3, 2, 9, "#3d7e3b"); box(c, x * T + 5 + k * 5, y * T + 4, 5, 3, "#aad369"); }
    }
  });
}
function well(c, x, y) {
  if (sprite(c, art.actors[7], x, y + 12, 47, 56)) return;
  oval(c, x, y + 10, 15, 5, "#41472944"); box(c, x - 13, y - 2, 26, 14, "#7e7967");
  for (let row = 0; row < 3; row++) for (let i = 0; i < 4; i++) box(c, x - 13 + i * 7 + row % 2 * 2, y - 1 + row * 4, 5, 3, ["#b3ad8b", "#a09a7e", "#c7bf97"][i % 3]);
  box(c, x - 9, y - 3, 18, 4, "#304b4d"); box(c, x - 11, y - 24, 3, 24, "#80552f"); box(c, x + 9, y - 24, 3, 24, "#80552f");
  polygon(c, [[x - 17, y - 22], [x - 9, y - 35], [x + 9, y - 35], [x + 17, y - 22]], "#a96843");
  for (let row = 0; row < 3; row++) box(c, x - 10 - row * 3, y - 32 + row * 4, 21 + row * 6, 1, "#d5955b");
  box(c, x, y - 20, 1, 21, "#cebb82"); box(c, x - 3, y - 1, 7, 5, "#896748");
}
function cat(c, x, y, time) {
  if (art.actors[4]) {
    oval(c, x, y + 6, 10, 3, "#3f513032"); sprite(c, art.actors[4], x, y + 7 + Math.sin(time * 1.8) * .4, 23, 29); return;
  }
  oval(c, x, y + 6, 10, 3, "#4b582a40"); const blink = Math.sin(time * .8) > .97;
  box(c, x - 7, y - 6, 13, 12, "#c58b47"); box(c, x - 8, y - 13, 15, 10, "#e4b367"); box(c, x - 8, y - 17, 4, 6, "#c58b47"); box(c, x + 3, y - 17, 4, 6, "#c58b47");
  box(c, x - 6, y - 15, 2, 3, "#e0a38b"); box(c, x + 4, y - 15, 2, 3, "#e0a38b"); box(c, x - 4, y - 9, 2, blink ? 1 : 2, "#4c4937"); box(c, x + 2, y - 9, 2, blink ? 1 : 2, "#4c4937"); box(c, x - 1, y - 5, 2, 2, "#ad6750");
  box(c, x - 4, y - 2, 6, 7, "#f0d5a0"); box(c, x + 6, y + Math.round(Math.sin(time * 2) * 2), 8, 3, "#dba052");
}
function hero(c, state, time) {
  const p = state.player, x = Math.round(p.drawX * T + 12), y = Math.round(p.drawY * T + 14);
  oval(c, x, y + 6, 9, 3, "#3a472f44"); if (state.invulnerable && Math.floor(time * 14) % 2) return;
  if (art.actors[0]) {
    const facing = p.facing[0] < 0 ? 2 : p.facing[0] > 0 ? 3 : p.facing[1] < 0 ? 1 : 0;
    const bob = p.walk > 0 ? Math.abs(Math.sin(time * 18)) * 1.6 : Math.sin(time * 2) * .25;
    c.save(); c.translate(x, y + 6 - bob); c.rotate(p.walk > 0 ? Math.sin(time * 18) * .028 : 0);
    const item = art.actors[facing]; sprite(c, item, 0, 0, 43 * item.w / item.h, 43); c.restore();
    if (state.swing > 0) {
      const a = Math.atan2(p.facing[1], p.facing[0]);
      c.save(); c.translate(x, y - 8); c.rotate(a); c.strokeStyle = "#ffedb5dd"; c.lineWidth = 2; c.beginPath(); c.arc(0, 0, 25, -1.1, 1.1); c.stroke();
      polygon(c, [[8, -1], [28, -4], [33, 0], [28, 2], [8, 2]], "#eff8ed"); box(c, 8, -5, 2, 12, "#c6a268"); box(c, 3, 0, 7, 2, "#79583d"); c.restore();
    }
    return;
  }
  const stride = p.walk > 0 ? Math.round(Math.sin(time * 20) * 2) : 0, side = p.facing[0], back = p.facing[1] < 0;
  box(c, x - 5, y - 7, 4, 11 + stride, "#405a68"); box(c, x + 1, y - 7, 4, 11 - stride, "#405a68"); box(c, x - 6, y + 3 + stride, 6, 3, "#543e32"); box(c, x, y + 3 - stride, 6, 3, "#543e32");
  box(c, x - 6, y - 18, 12, 13, "#5984a0"); box(c, x - 4, y - 17, 2, 10, "#8ab3b8"); box(c, x + 4, y - 17, 2, 12, "#406174"); box(c, x - 8, y - 16 - stride, 3, 8, "#e6b78b"); box(c, x + 6, y - 16 + stride, 3, 8, "#dca67d");
  if (back) { box(c, x - 4, y - 15, 8, 9, "#b89962"); box(c, x - 3, y - 14, 6, 3, "#d4bb80"); } else { box(c, x - 1, y - 17, 2, 6, "#ecdfb8"); box(c, x - 5, y - 7, 10, 2, "#304b60"); }
  box(c, x - 6 + side, y - 27, 12, 11, "#e8bd90"); box(c, x - 5 + side, y - 19, 9, 3, "#c99170"); box(c, x - 7, y - 29, 13, 6, "#453c36"); box(c, x - 5, y - 31, 9, 3, "#453c36"); box(c, x - 5, y - 29, 5, 2, "#675241"); box(c, x - 7, y - 24, back ? 13 : 3, back ? 7 : 6, "#453c36");
  if (!back) { if (side <= 0) box(c, x - 3 + side * 2, y - 21, 2, 2, "#3d4039"); if (side >= 0) box(c, x + 3 + side, y - 21, 2, 2, "#3d4039"); }
  if (state.swing > 0) {
    const angle = p.facing[0] ? (p.facing[0] > 0 ? 0 : Math.PI) : p.facing[1] > 0 ? Math.PI / 2 : -Math.PI / 2;
    c.strokeStyle = "#ffed9bbb"; c.lineWidth = 4; c.beginPath(); c.arc(x, y - 8, 23, angle - 1.2, angle + 1.2); c.stroke();
    const sx = x + Math.cos(angle) * 16, sy = y - 8 + Math.sin(angle) * 16;
    box(c, sx - 1, sy - 11, 3, 15, "#dbeded"); box(c, sx - 4, sy + 3, 9, 2, "#bc8d4d"); box(c, sx, sy + 5, 2, 5, "#755235");
  }
}
function guardian(c, m, time) {
  const x = m.x * T + 12, y = m.y * T + 14, hop = Math.max(0, Math.sin(time * 3 + m.x)) * 3;
  oval(c, x, y + 8, 15, 4, "#344b2a44");
  if (!m.hp) {
    if (sprite(c, art.props[3], x, y + 9, 29, 25)) { label(c, "✦", x + 17, y - 15 + Math.sin(time * 3) * 2, 10, "#ffefa5"); return; }
    box(c, x - 11, y - 6, 24, 15, "#785030"); box(c, x - 12, y - 12, 26, 12, "#ba803b"); box(c, x - 9, y - 11, 20, 2, "#e6b35e"); box(c, x - 12, y, 26, 3, "#4f3b28"); box(c, x - 8, y - 10, 3, 18, "#dbab54"); box(c, x + 7, y - 10, 3, 18, "#dbab54"); box(c, x - 1, y - 1, 4, 6, "#ffdc7c"); label(c, "✦", x + 17, y - 15 + Math.sin(time * 3) * 2, 12, "#ffefa5"); return;
  }
  if (m.charge > .12) { c.strokeStyle = m.charge > .55 ? "#f28c54cc" : "#c8825766"; c.lineWidth = 2; c.strokeRect(x - 30, y - 34, 60, 58); label(c, "!", x, y - 34, 14, "#ffe5a0"); }
  if (art.actors[5]) {
    c.save(); if (m.flash) c.globalAlpha = .62;
    sprite(c, art.actors[m.id === "forest" ? 5 : 6], x, y + 7 - hop, 33, 40); c.restore();
    box(c, x - 14, y - 40 - hop, 28, 3, "#574937"); box(c, x - 13, y - 39.5 - hop, 26 * m.hp / 3, 2, "#cb8761"); return;
  }
  const tint = m.flash ? "#fff0b0" : m.id === "forest" ? "#bd8c56" : "#9a7aaf", dark = m.id === "forest" ? "#78563a" : "#655079";
  box(c, x - 12, y - 18 - hop, 24, 19, dark); box(c, x - 14, y - 13 - hop, 28, 12, dark); box(c, x - 11, y - 19 - hop, 22, 17, tint); box(c, x - 8, y - 23 - hop, 16, 5, tint); box(c, x - 9, y - 22 - hop, 4, 3, "#e8cea0"); box(c, x - 4, y - 25 - hop, 7, 4, m.id === "forest" ? "#69964b" : "#c7bbd4");
  box(c, x - 7, y - 13 - hop, 4, 5, "#efe2c4"); box(c, x + 3, y - 13 - hop, 4, 5, "#efe2c4"); box(c, x - 5, y - 11 - hop, 2, 3, "#45473e"); box(c, x + 4, y - 11 - hop, 2, 3, "#45473e"); box(c, x - 5, y - 4 - hop, 10, 3, "#ead1a4"); box(c, x - 10, y + 1, 7, 5, dark); box(c, x + 4, y + 1, 7, 5, dark);
  for (let i = 0; i < 3; i++) box(c, x - 12 + i * 9, y - 30 - hop, 7, 2, i < m.hp ? "#9b453b" : "#c2ae82");
}
function roomImage(id) {
  if (art.room) return cached(`room-v2-${id}`, 1080, 864, c => {
    c.scale(3, 3); c.drawImage(art.room, 0, 0, 360, 288);
    label(c, HOUSES.find(h => h.id === id).name, 180, 42, 10, "#654a31");
    for (const x of [2, 12]) sprite(c, art.props[5], x * T + 12, 7 * T + 20, 25, 37);
    drawExhibits(c, id); label(c, "返回小镇", 180, 265, 7, "#fff0d0");
  });
  return cached(`room-${id}`, 360, 288, c => {
    box(c, 0, 0, 360, 288, "#322c29"); box(c, 19, 31, 323, 237, "#6b4934");
    for (let y = 76; y < 263; y += 12) for (let x = 23; x < 340; x += 36) { box(c, x, y, 35, 11, (x + y) % 3 ? "#bb8c58" : "#c69a61"); box(c, x + 3, y + 3, 20, 1, "#d4aa6d"); box(c, x + 8, y + 8, 17, 1, "#a4784d"); }
    box(c, 23, 33, 314, 46, id === "cinema" ? "#84978f" : "#d7bf8e");
    for (let x = 24; x < 337; x += 13) box(c, x, 34, 1, 41, "#ad98734d");
    box(c, 21, 76, 318, 5, "#6f4d35"); box(c, 21, 33, 318, 5, "#8c653e"); box(c, 21, 32, 6, 230, "#765234"); box(c, 333, 32, 6, 230, "#765234");
    for (const x of [52, 280]) {
      box(c, x, 43, 28, 27, "#71523b"); box(c, x + 3, 46, 22, 20, "#9cbdba"); box(c, x + 13, 46, 2, 20, "#f4ddb0"); box(c, x + 3, 55, 22, 2, "#f4ddb0"); box(c, x - 3, 41, 7, 32, "#b16d59"); box(c, x + 25, 41, 7, 32, "#b16d59"); polygon(c, [[x, 81], [x + 29, 81], [x + 70, 145], [x + 18, 145]], "#fff0b523");
    }
    box(c, 103, 157, 158, 55, "#845447"); box(c, 107, 161, 150, 47, id === "cinema" ? "#698c87" : "#bd8062");
    for (let x = 112; x < 254; x += 7) { box(c, x, 164, 3, 2, "#e4bb86"); box(c, x, 202, 3, 2, "#e4bb86"); }
    box(c, 168, 257, 26, 14, "#dfbc78"); box(c, 170, 264, 22, 9, "#241f21"); label(c, "出口", 181, 254, 8);
    for (const x of [54, 294]) { box(c, x, 169, 24, 15, "#765039"); box(c, x - 2, 163, 28, 9, "#b68b57"); flowerPot(c, x + 5, 153, id === "library" ? 1 : 0); }
    label(c, HOUSES.find(h => h.id === id).name, 181, 57, 13, "#694830");
    drawExhibits(c, id);
  });
}
function drawExhibits(c, id) {
    roomExhibits(id).forEach((e, i) => {
      const x = e.x * T + 12, y = e.y * T + 12;
      if (art.props.length) {
        const item = id === "library" ? 2 : id === "cinema" && i === 1 ? 1 : 0;
        sprite(c, art.props[item], x, y + 8, item === 2 ? 53 : item === 1 ? 36 : 28, 48);
        label(c, id === "library" ? "手记" : id === "cinema" ? (i ? "放映机" : "照片") : `作品 ${i + 1}`, x, y + 20, 7, "#fff0c8"); return;
      }
      if (id === "library") {
        box(c, x - 26, y - 31, 52, 37, "#71513b");
        for (let row = 0; row < 2; row++) for (let n = 0; n < 9; n++) { box(c, x - 22 + n * 5, y - 26 + row * 17, 4, 13, ["#967052", "#708879", "#b29763", "#b4705d"][n % 4]); box(c, x - 21 + n * 5, y - 23 + row * 17, 2, 1, "#e1cb9b"); }
        box(c, x - 26, y - 12, 52, 3, "#bf975d");
      } else if (id === "cinema" && i === 1) {
        box(c, x - 20, y - 4, 40, 10, "#9b704b"); box(c, x - 10, y - 21, 20, 18, "#4d5551"); oval(c, x - 6, y - 25, 8, 8, "#aeb1a0"); oval(c, x + 8, y - 25, 8, 8, "#999f94"); box(c, x - 20, y - 15, 12, 7, "#778a7f"); box(c, x - 23, y - 16, 4, 9, "#bcbb9a");
      } else {
        box(c, x - 17, y - 31, 34, 35, "#745034"); box(c, x - 15, y - 29, 30, 31, "#d1ae6c"); box(c, x - 12, y - 26, 24, 25, "#f2dbad"); box(c, x - 10, y - 24, 20, 10, ["#91b2aa", "#bb9894", "#8a9e81"][i]); polygon(c, [[x - 10, y - 10], [x - 1, y - 21], [x + 10, y - 7], [x + 10, y - 3], [x - 10, y - 3]], "#7c9566"); box(c, x - 17, y + 4, 34, 3, "#593e2f");
      }
      label(c, id === "library" ? "手记" : id === "cinema" ? (i ? "放映机" : "照片") : `作品 ${i + 1}`, x, y + 17, 8, "#fff0c8");
    });
}
export function drawTown(ctx, state, time) {
  const ratio = Number(ctx.canvas.dataset?.scale) || 1;
  const width = ctx.canvas.width / ratio, height = ctx.canvas.height / ratio, indoor = Boolean(state.room), worldW = indoor ? 360 : 720, worldH = indoor ? 288 : 432;
  const overview = state.overview && !indoor, zoom = overview ? Math.min(width / worldW, height / worldH) : indoor ? (height < 330 ? 1.4 : 2.05) : height < 330 ? 1.2 : 1.8;
  const viewW = width / zoom, viewH = height / zoom, bound = (target, total, view) => total <= view ? (total - view) / 2 : clamp(target - view / 2, 0, total - view);
  const targetX = bound(state.player.drawX * T + 12, worldW, viewW), targetY = bound(state.player.drawY * T + 1 - (indoor ? 0 : viewH * .12), worldH, viewH);
  if (!state.camera || state.camera.overview !== overview) state.camera = { x: targetX, y: targetY, overview };
  else { state.camera.x += (targetX - state.camera.x) * .14; state.camera.y += (targetY - state.camera.y) * .14; }
  const camX = overview ? (worldW - viewW) / 2 : state.camera.x, camY = overview ? (worldH - viewH) / 2 : state.camera.y;
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0); ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
  box(ctx, 0, 0, width, height, indoor ? "#292c29" : "#617c51");
  ctx.save(); ctx.scale(zoom, zoom); ctx.translate(-camX, -camY);
  if (indoor) ctx.drawImage(roomImage(state.room), 0, 0, 360, 288);
  else {
    ctx.drawImage(groundImage(), 0, 0, 720, 432);
    for (let i = 0; i < 13; i++) { const x = 417 + (i * 23) % 80, y = 323 + (i * 17) % 76; box(ctx, x + Math.sin(time + i) * 3, y, 8, 1, "#a0cacc"); box(ctx, x + 2, y + 2, 3, 1, "#75b1bc"); }
    box(ctx, 455, 353, 10, 4, "#a8bd65"); box(ctx, 459, 350, 3, 3, "#f0d2b0");
    const objects = HOUSES.map((h, i) => ({ y: (h.y + h.h) * T, draw: () => {
      if (!sprite(ctx, art.scenery[i], h.door[0] * T + 12, h.door[1] * T + 13, 142, 135)) ctx.drawImage(houseImage(h, i), h.x * T - 12, h.y * T - 30);
      else { box(ctx, h.door[0] * T - 14, h.door[1] * T - 36, 52, 12, "#493c2ac9"); label(ctx, h.name, h.door[0] * T + 12, h.door[1] * T - 27, 8, "#fff0cc"); }
    } }));
    const trees = [...WORLD_TREES];
    for (let x = 0; x < 30; x += 2) trees.push([x, 1], [x, 18]);
    for (let y = 4; y < 18; y += 2) trees.push([0, y], [30, y]);
    trees.forEach(([x, y], i) => objects.push({ y: y * T + 13, draw: () => {
      if (!sprite(ctx, art.scenery[3 + i % 3], x * T + 12, y * T + 20, i % 3 === 2 ? 65 : 86, 99)) ctx.drawImage(treeImage(i % 3), x * T - 26, y * T - 73);
    } }));
    objects.push({ y: 3 * T + 12, draw: () => well(ctx, 9 * T + 12, 3 * T + 12) });
    objects.push({ y: 9 * T + 14, draw: () => cat(ctx, 10 * T + 12, 9 * T + 14, time) });
    objects.push({ y: 15 * T + 12, draw: () => { const x = 21 * T + 12, y = 15 * T + 12 + Math.sin(time * 2); if (!sprite(ctx, art.props[4], x, y + 7, 10, 19)) { box(ctx, x - 3, y - 7, 7, 12, "#7ab8ac"); box(ctx, x - 1, y - 11, 3, 5, "#a1c2a3"); box(ctx, x - 1, y - 13, 3, 3, "#aa7a46"); box(ctx, x - 1, y - 3, 3, 5, "#efe2b6"); } label(ctx, "✦", x + 9, y - 9, 9); } });
    state.monsters.forEach(m => objects.push({ y: m.y * T + 20, draw: () => guardian(ctx, m, time) }));
    objects.push({ y: state.player.drawY * T + 20, draw: () => hero(ctx, state, time) });
    objects.sort((a, b) => a.y - b.y).forEach(object => object.draw());
    HOUSES.slice(0, 2).forEach((h, i) => { for (let n = 0; n < 3; n++) { const phase = (time * 8 + n * 12 + i * 5) % 40; box(ctx, h.x * T + 106 + Math.sin(phase / 10) * 3, h.y * T - 24 - phase, 4 + phase / 10, 3, "#f9e7c235"); } });
    for (let i = 0; i < 6; i++) { const x = 92 + i * 99 + Math.sin(time * .6 + i) * 12, y = 225 + Math.sin(time * .9 + i * 2) * 25; box(ctx, x, y, 1, 3, "#ad7b46"); box(ctx, x - (Math.sin(time * 8) > 0 ? 3 : 1), y - 1, 3, 2, "#f7dca0"); box(ctx, x + 1, y - 1, 3, 2, "#ebbe8d"); }
  }
  if (indoor) hero(ctx, state, time);
  if (interactTown(state)) { const x = state.player.drawX * T + 12, y = state.player.drawY * T - 26; box(ctx, x - 12, y - 9, 24, 13, "#fff0c7"); box(ctx, x - 11, y - 8, 22, 1, "#fff9dd"); label(ctx, "E / B", x, y, 7, "#6f4b31"); }
  state.effects.forEach(e => label(ctx, e.text, e.x * T + 12, e.y * T - 20 - (1 - e.life) * 17, 10, e.color));
  ctx.restore();
}
