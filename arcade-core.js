export const SLOT_DEFS = [
  { id: "work-1", label: "作品展位 01", kind: "作品" },
  { id: "work-2", label: "作品展位 02", kind: "作品" },
  { id: "work-3", label: "作品展位 03", kind: "作品" },
  { id: "photo-1", label: "照片墙", kind: "照片" },
  { id: "video-1", label: "放映厅", kind: "视频" },
  { id: "note-1", label: "灵感手记", kind: "文章" },
  { id: "forest-reward", label: "森林宝箱", kind: "趣事" },
  { id: "castle-reward", label: "城堡宝箱", kind: "作品" },
  { id: "secret-cat", label: "橘猫的礼物", kind: "彩蛋" },
  { id: "secret-well", label: "第四次愿望", kind: "彩蛋" },
  { id: "secret-bottle", label: "来自未来的明信片", kind: "彩蛋" }
];

export function contentSlots(saved = {}) {
  return SLOT_DEFS.map((slot) => {
    const value = saved?.[slot.id] || {};
    const fields = Object.fromEntries(["title", "body", "url", "mediaName", "mediaType", "mediaUrl"].map(key => [key, typeof value[key] === "string" ? value[key] : ""]));
    return { ...fields, ...slot };
  });
}

export function safeLink(value) {
  try { const url = new URL(value); return ["http:", "https:"].includes(url.protocol) ? url.href : ""; } catch { return ""; }
}

export function isSafeMediaType(type) {
  return /^(image\/(jpeg|png|webp|gif|avif|bmp)|video\/(mp4|webm|ogg|quicktime)|application\/pdf)$/.test(type);
}

export async function persistSlot(id, value, file, removeMedia, api) {
  const key = `arcade-${id}`, changesAsset = Boolean(file || removeMedia);
  const previous = changesAsset ? await api.getAsset(key) : null;
  let assetChanged = false;
  try {
    if (file) { await api.saveAsset(key, file); assetChanged = true; }
    else if (removeMedia) { await api.deleteAsset(key); assetChanged = true; }
    await api.saveContent(id, value);
  } catch (error) {
    if (assetChanged) {
      try {
        if (previous) await api.saveAsset(key, previous);
        else await api.deleteAsset(key);
      } catch { throw new Error("保存和附件恢复均未完成，请保留原文件并重新上传。"); }
    }
    throw new Error("未能完成保存，原内容已保留。请检查浏览器存储空间。", { cause: error });
  }
}

export function isReady(slot) {
  return Boolean(slot.title?.trim() || slot.body?.trim() || safeLink(slot.url) || slot.mediaName || slot.mediaUrl);
}

export function drawCapsule(cards, seen, random = Math.random) {
  if (!cards.length) return null;
  const fresh = cards.filter(card => !seen.includes(card.id));
  const pool = fresh.length ? fresh : cards;
  return pool[Math.min(pool.length - 1, Math.floor(random() * pool.length))];
}

export const HOUSES = [
  { id: "workshop", name: "作品工坊", x: 3, y: 4, w: 5, h: 4, door: [5, 8], color: "#cd694c", slots: ["work-1", "work-2", "work-3"] },
  { id: "cinema", name: "放映小屋", x: 12, y: 3, w: 5, h: 4, door: [14, 7], color: "#4e809c", slots: ["photo-1", "video-1"] },
  { id: "library", name: "灵感书屋", x: 22, y: 4, w: 5, h: 4, door: [24, 8], color: "#9972a0", slots: ["note-1"] }
];

export const SECRET_SPOTS = [
  { id: "cat", name: "路边的橘猫", x: 10, y: 9, title: "小镇朋友", hint: "它好像还想被摸摸。", count: 3, slot: "secret-cat" },
  { id: "well", name: "许愿井", x: 9, y: 3, title: "第四次愿望", hint: "井沿刻着一个小小的「四」。", count: 4, slot: "secret-well" },
  { id: "bottle", name: "漂流瓶", x: 21, y: 15, title: "来自未来的信", hint: "水边有什么在闪光。", count: 1, slot: "secret-bottle" }
];
export const WORLD_TREES = [[2, 3], [10, 5], [19, 3], [27, 3], [2, 14], [4, 15], [12, 14], [13, 16], [27, 14]];

export function roomExhibits(id) {
  const house = HOUSES.find(h => h.id === id);
  return (house?.slots || []).map((slot, i, list) => ({ x: list.length === 1 ? 7 : list.length === 2 ? 4 + i * 6 : 4 + i * 3, y: 4, slots: [slot], type: "exhibit", name: id === "cinema" ? (i ? "放映机" : "照片墙") : id === "library" ? "书架上的手记" : `作品画框 ${i + 1}` }));
}

export function createTown(defeated = [], progress = {}) {
  const ids = Array.isArray(defeated) ? [...new Set(defeated.filter(id => ["forest", "castle"].includes(id)))] : [];
  return {
    player: { x: 15, y: 11, drawX: 15, drawY: 11, hp: 4, facing: [0, 1], walk: 0 }, defeated: ids,
    room: null, outdoor: null, effects: [], camera: null, steps: 0,
    visited: Array.isArray(progress.visited) ? [...new Set(progress.visited.filter(id => HOUSES.some(h => h.id === id)))] : [],
    secrets: Array.isArray(progress.secrets) ? [...new Set(progress.secrets.filter(id => SECRET_SPOTS.some(s => s.id === id)))] : [],
    secretTouches: {},
    attackCooldown: 0, invulnerable: 0, swing: 0, message: "欢迎来到小四小镇。沿小路走走，看看门后藏着什么。",
    monsters: [
      { id: "forest", name: "森林守卫", x: 7, y: 14, slot: "forest-reward", color: "#d58645" },
      { id: "castle", name: "城堡守卫", x: 24, y: 14, slot: "castle-reward", color: "#8875b2" }
    ].map(m => ({ ...m, hp: ids.includes(m.id) ? 0 : 3, charge: 0, flash: 0 }))
  };
}

export function canWalk(x, y) {
  if (x < 1 || x > 28 || y < 2 || y > 16) return false;
  if (x >= 17 && x <= 20 && y >= 13 && y <= 16) return false;
  return !HOUSES.some(h => x >= h.x && x < h.x + h.w && y >= h.y && y < h.y + h.h);
}

export function movePlayer(state, dx, dy) {
  state.player.facing = [dx, dy];
  const x = state.player.x + dx, y = state.player.y + dy;
  const indoors = x >= 1 && x <= 13 && y >= 3 && y <= 10 && !roomExhibits(state.room).some(e => e.x === x && e.y === y) && !(y === 7 && [2, 12].includes(x));
  const outdoors = canWalk(x, y) && !WORLD_TREES.some(([tx, ty]) => tx === x && ty === y) && !SECRET_SPOTS.some(s => s.id !== "bottle" && s.x === x && s.y === y) && !state.monsters.some(m => m.hp > 0 && m.x === x && m.y === y);
  if (state.room ? indoors : outdoors) {
    state.player.x = x; state.player.y = y;
    state.player.walk = 0.18; state.steps++;
  }
}

export function enterTownRoom(state, id) {
  const house = HOUSES.find(h => h.id === id); if (!house) return;
  state.outdoor = { x: house.door[0], y: house.door[1] };
  state.room = id; state.camera = null; state.effects = [];
  if (!state.visited.includes(id)) state.visited.push(id);
  Object.assign(state.player, { x: 7, y: 9, drawX: 7, drawY: 9, facing: [0, -1], walk: 0 });
  state.message = `进入${house.name}。走近展品按 B / E，门口可返回小镇。`;
}

export function leaveTownRoom(state) {
  if (!state.room) return;
  const p = state.outdoor || { x: 15, y: 11 };
  Object.assign(state.player, { ...p, drawX: p.x, drawY: p.y, facing: [0, 1], walk: 0 });
  state.room = null; state.camera = null; state.effects = [];
  state.message = "回到小镇。屋外还有一些不太显眼的小惊喜。";
}

export function discoverSecret(state, id) {
  const spot = SECRET_SPOTS.find(s => s.id === id); if (!spot) return null;
  state.secretTouches[id] = (state.secretTouches[id] || 0) + 1;
  const unlocked = state.secrets.includes(id) || state.secretTouches[id] >= spot.count;
  state.effects.push({ x: spot.x, y: spot.y, text: id === "cat" ? "♥" : "✦", color: "#ffe2a2", life: 1 });
  if (unlocked) {
    if (!state.secrets.includes(id)) state.secrets.push(id);
    state.player.hp = 4;
    state.message = `发现彩蛋「${spot.title}」，爱心已恢复。`;
  } else state.message = id === "cat" ? `喵～ ${spot.hint}` : `许下了第 ${state.secretTouches[id]} 个愿望。${spot.hint}`;
  return { unlocked, title: spot.title, slots: [spot.slot] };
}

const distance = (p, q) => Math.abs(p.x - q.x) + Math.abs(p.y - q.y);

export function interactTown(state) {
  if (state.room) {
    if (distance(state.player, { x: 7, y: 10 }) <= 1) return { type: "exit", name: "返回小镇" };
    return roomExhibits(state.room).find(e => distance(state.player, e) <= 1) || null;
  }
  const house = HOUSES.find(h => distance(state.player, { x: h.door[0], y: h.door[1] }) <= 1);
  if (house) return house;
  const chest = state.monsters.find(m => m.hp === 0 && distance(state.player, m) <= 1);
  if (chest) return { type: "chest", id: chest.id, name: chest.id === "forest" ? "森林宝箱" : "城堡宝箱", slots: [chest.slot] };
  const secret = SECRET_SPOTS.find(s => distance(state.player, s) <= 1);
  return secret ? { ...secret, type: "secret" } : null;
}

export function attackTown(state) {
  if (state.room) { state.message = "屋内不用挥剑。走近画框、书架或放映机，按 B / E 互动。"; return; }
  if (state.attackCooldown > 0) return;
  state.attackCooldown = 0.3; state.swing = 0.18;
  const monster = state.monsters.find(m => m.hp > 0 && distance(state.player, m) <= 1);
  if (!monster) { state.message = "靠近守卫再按 A / 空格攻击。"; return; }
  monster.hp--; monster.flash = 0.18;
  state.effects.push({ x: monster.x, y: monster.y, text: monster.hp ? "−1" : "✦ 宝箱出现", color: monster.hp ? "#fff0b1" : "#fff7a4", life: 0.9 });
  if (!monster.hp) {
    state.defeated.push(monster.id);
    state.message = `${monster.name}让出了宝箱！靠近按 B / E 打开。`;
  } else state.message = `${monster.name}还剩 ${monster.hp} 格能量，红色预警时记得躲开。`;
}

export function tickTown(state, dt) {
  const p = state.player;
  p.drawX += (p.x - p.drawX) * Math.min(1, dt * 13);
  p.drawY += (p.y - p.drawY) * Math.min(1, dt * 13);
  if (Math.abs(p.x - p.drawX) < 0.005) p.drawX = p.x;
  if (Math.abs(p.y - p.drawY) < 0.005) p.drawY = p.y;
  p.walk = Math.max(0, p.walk - dt);
  state.effects.forEach(e => { e.life -= dt; }); state.effects = state.effects.filter(e => e.life > 0);
  state.attackCooldown = Math.max(0, state.attackCooldown - dt);
  state.invulnerable = Math.max(0, state.invulnerable - dt);
  state.swing = Math.max(0, state.swing - dt);
  if (state.room) return;
  state.monsters.forEach(m => {
    m.flash = Math.max(0, m.flash - dt);
    if (!m.hp || distance(state.player, m) > 1) { m.charge = 0; return; }
    m.charge += dt;
    if (m.charge < 0.8) return;
    m.charge = 0;
    if (state.invulnerable > 0) return;
    state.player.hp--; state.invulnerable = 0.7;
    state.message = "被守卫碰到了，退开一格躲避蓄力。";
    if (!state.player.hp) {
      Object.assign(state.player, { x: 15, y: 11, drawX: 15, drawY: 11, hp: 4 });
      state.camera = null;
      state.message = "回到小镇广场，已发现的宝箱不会丢失。";
    }
  });
}
