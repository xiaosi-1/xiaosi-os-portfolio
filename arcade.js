import { SLOT_DEFS, contentSlots, isReady, safeLink, isSafeMediaType, persistSlot, drawCapsule, createTown, HOUSES, SECRET_SPOTS, enterTownRoom, leaveTownRoom, discoverSecret, movePlayer, interactTown, attackTown, tickTown } from "./arcade-core.js";
import { drawTown, loadTownArt, canvasMetrics } from "./arcade-art.js";

const esc = (v = "") => String(v).replace(/[&<>'"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[c]));
const PROGRESS_KEY = "xiaosi-arcade-progress-v1";
const directions = { ArrowUp: [0, -1], w: [0, -1], ArrowDown: [0, 1], s: [0, 1], ArrowLeft: [-1, 0], a: [-1, 0], ArrowRight: [1, 0], d: [1, 0] };

function readProgress() {
  try {
    const value = JSON.parse(localStorage.getItem(PROGRESS_KEY)) || {};
    return Object.fromEntries(["seen", "favorites", "defeated", "visited", "secrets"].map(key => [key, Array.isArray(value[key]) ? value[key].filter(v => typeof v === "string") : []]));
  } catch { return { seen: [], favorites: [], defeated: [], visited: [], secrets: [] }; }
}

export function arcadeHTML(type) {
  return `<div class="arcade-host ${type === "town" ? "town-host" : "gacha-host"}"></div>`;
}

export function mountArcade(el, type, api) {
  const host = el.querySelector(".arcade-host");
  const abort = new AbortController();
  const $ = selector => host.querySelector(selector);
  const on = (node, event, callback) => node.addEventListener(event, callback, { signal: abort.signal });
  const slots = () => contentSlots(api.getContent());
  let sheet = null, sheetTrigger = null, objectUrls = [], timers = new Set(), frame = 0, dead = false;
  let town, refresh = () => {}, held = new Set(), paused = false, blurred = false;
  const later = (callback, ms) => {
    const id = setTimeout(() => { timers.delete(id); if (!dead) callback(); }, ms);
    timers.add(id);
  };
  const remember = (key, value) => {
    const progress = readProgress(); progress[key] = [...new Set(value)];
    try { localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress)); } catch { api.notify("浏览器未允许保存进度，本次仍可继续游玩。"); }
  };
  const cleanupMedia = () => {
    sheet?.querySelectorAll("video").forEach(video => video.pause());
    objectUrls.forEach(URL.revokeObjectURL); objectUrls = [];
  };
  function closeSheet() {
    cleanupMedia(); sheet?.remove(); sheet = null; held.clear();
    [...host.children].forEach(child => { child.inert = false; });
    if (type === "town") $("canvas")?.focus({ preventScroll: true });
    else if (sheetTrigger?.isConnected) sheetTrigger.focus();
    else $("canvas")?.focus({ preventScroll: true });
  }
  function openSheet(title, body) {
    if (!sheet) sheetTrigger = document.activeElement;
    cleanupMedia(); sheet?.remove(); held.clear();
    [...host.children].forEach(child => { child.inert = true; });
    sheet = document.createElement("section");
    sheet.className = "arcade-sheet";
    sheet.setAttribute("role", "region"); sheet.setAttribute("aria-label", title);
    sheet.innerHTML = `<header><strong>${esc(title)}</strong><button type="button" data-sheet-close>返回游戏 ×</button></header><div class="arcade-sheet-body">${body}</div>`;
    host.append(sheet);
    on(sheet.querySelector("[data-sheet-close]"), "click", closeSheet);
    sheet.querySelector("[data-sheet-close]").focus({ preventScroll: true });
  }
  function showDirectory(ids = SLOT_DEFS.map(s => s.id), title = "内容目录", room = "") {
    const cards = slots().filter(s => ids.includes(s.id));
    openSheet(title, `${room ? `<div class="room-scene ${room}" aria-hidden="true"><span class="room-window"></span><span class="room-rug"></span><span class="room-desk"></span><b>${esc(title)}</b></div>` : ""}<p class="arcade-muted">${api.editMode ? "选择一个展位，填文字或上传素材。" : "可以直接查看内容，不必重复通关。"}</p><div class="arcade-slot-grid">${cards.map(s => `<button type="button" class="arcade-slot" data-slot="${s.id}"><span>${esc(s.kind)}</span><strong>${esc(s.title || s.label)}</strong><small>${isReady(s) ? "打开内容 ↗" : "待补充 · 预留展位"}</small></button>`).join("") || `<p class="arcade-muted">还没有收藏。抽到内容后，可以加入收藏。</p>`}</div>`);
    sheet.querySelectorAll("[data-slot]").forEach(button => on(button, "click", () => showCard(button.dataset.slot)));
  }
  async function showCard(id) {
    const slot = slots().find(s => s.id === id); if (!slot) return;
    const ready = isReady(slot), favorite = readProgress().favorites.includes(id);
    openSheet(slot.label, `<article class="arcade-card"><p class="arcade-kicker">${esc(slot.kind)} / ${esc(slot.id)}</p><h2>${esc(slot.title || "这个位置，留给下一份精彩。")}</h2><p class="arcade-card-copy">${esc(slot.body || (ready ? "" : "内容待补充。这里可以放作品、照片、视频、文章或一段个人故事。"))}</p><div data-card-media></div><div class="arcade-card-actions">${safeLink(slot.url) ? `<a href="${esc(safeLink(slot.url))}" target="_blank" rel="noopener noreferrer">打开完整内容 ↗</a>` : ""}<button type="button" data-favorite ${ready ? "" : "disabled"}>${favorite ? "已收藏 · 取消" : "☆ 收藏"}</button><button type="button" data-directory>内容目录</button>${api.editMode ? `<button type="button" data-edit-slot>编辑这个展位</button>` : ""}</div><small class="arcade-muted" data-card-status>${ready ? "收藏只保存在当前浏览器。" : "这是内容入口，不是虚构的作品或经历。"}</small></article>`);
    on($("[data-directory]"), "click", () => showDirectory());
    if (api.editMode) on($("[data-edit-slot]"), "click", () => editSlot(id));
    on($("[data-favorite]"), "click", () => {
      const favorites = readProgress().favorites;
      remember("favorites", favorites.includes(id) ? favorites.filter(v => v !== id) : [...favorites, id]);
      showCard(id); refresh();
    });
    const target = $("[data-card-media]");
    try {
      const blob = await api.getAsset(`arcade-${id}`);
      if (dead || !target.isConnected) return;
      let url = "", mime = slot.mediaType;
      if (blob) { url = URL.createObjectURL(blob); objectUrls.push(url); mime = blob.type; }
      else if (slot.mediaUrl && /^(assets\/|https:\/\/)/.test(slot.mediaUrl)) url = slot.mediaUrl;
      if (!url) {
        if (slot.mediaName) $("[data-card-status]").textContent = "附件未在当前浏览器找到，请在编辑模式重新上传。";
        return;
      }
      if (!isSafeMediaType(mime)) { $("[data-card-status]").textContent = "此附件格式不受支持，请换成 PNG、JPG、MP4 或 PDF。"; return; }
      if (mime.startsWith("image/")) {
        const image = new Image(); image.src = url; image.alt = slot.title || slot.label;
        target.append(image);
      } else if (mime.startsWith("video/")) {
        const video = document.createElement("video"); video.src = url; video.controls = true; video.playsInline = true; video.preload = "metadata"; target.append(video);
      }
      const link = document.createElement("a"); link.href = url; link.download = slot.mediaName || "attachment"; link.rel = "noopener"; link.textContent = "下载附件 ↓"; target.append(link);
    } catch { if (target.isConnected) $("[data-card-status]").textContent = "附件暂时无法读取，文字内容仍可浏览。"; }
  }
  function editSlot(id) {
    const slot = slots().find(s => s.id === id);
    openSheet(`编辑 · ${slot.label}`, `<form class="arcade-edit"><p class="arcade-muted">这个展位同时用于房子 / 宝箱和扭蛋机。无需修改游戏代码。</p><label>标题<input name="title" maxlength="100" value="${esc(slot.title)}" placeholder="还没准备好可以留空"></label><label>内容介绍<textarea name="body" rows="4">${esc(slot.body)}</textarea></label><label>完整内容链接（可选）<input name="url" type="url" value="${esc(slot.url)}" placeholder="https://..."></label><label>上传图片 / 视频 / PDF<input name="media" type="file" accept="image/*,video/*,application/pdf"></label><small>${esc(slot.mediaName || "尚未上传附件")}</small>${slot.mediaName || slot.mediaUrl ? `<label class="arcade-remove"><input type="checkbox" name="removeMedia">移除这个展位的附件（保留文字）</label>` : ""}<button type="submit">保存展位</button><p role="status" data-save-status>修改仅保存在当前浏览器；正式发布仍需导出内容和提供附件原文件。</p></form>`);
    const form = $("form"), status = $("[data-save-status]");
    on(form, "submit", async event => {
      event.preventDefault();
      const values = new FormData(form), file = form.elements.media.files[0];
      const removeMedia = values.has("removeMedia") && !file;
      const url = String(values.get("url")).trim();
      if (url && !safeLink(url)) { status.textContent = "请使用 http 或 https 链接。"; return; }
      if (file && !isSafeMediaType(file.type)) { status.textContent = "请选择 PNG、JPG、WebP、GIF、AVIF、BMP、MP4、WebM、MOV、OGG 或 PDF。SVG 请先转为 PNG。"; return; }
      if (file && file.size > 100 * 1024 * 1024) { status.textContent = "请先压缩到 100 MB 以内，或填写外部链接。"; return; }
      form.querySelector("[type=submit]").disabled = true; status.textContent = "正在保存…";
      try {
        await persistSlot(id, { title: String(values.get("title")).trim(), body: String(values.get("body")).trim(), url,
          mediaName: removeMedia ? "" : file?.name || slot.mediaName, mediaType: removeMedia ? "" : file?.type || slot.mediaType, mediaUrl: file || removeMedia ? "" : slot.mediaUrl }, file, removeMedia, api);
        if (!dead && form.isConnected) { showCard(id); refresh(); api.notify("展位已保存在当前浏览器"); }
      } catch (error) { if (form.isConnected) { status.textContent = error.message || "未能完成保存，请检查浏览器存储空间。"; form.querySelector("[type=submit]").disabled = false; } }
    });
  }
  on(host, "keydown", event => {
    if (event.key === "Escape" && sheet) { event.stopPropagation(); closeSheet(); }
  });
  on(window, "xiaosi-arcade-content", () => refresh());

  if (type === "gacha") {
    host.innerHTML = `<div class="gacha-layout"><section class="gacha-machine-wrap"><p class="arcade-kicker">XIAOSI TOY COMPANY / NO. 004</p><div class="gacha-machine"><div class="gacha-sign">小四的奇妙扭蛋<span>TURN A LITTLE. FIND A STORY.</span></div><div class="gacha-glass" aria-hidden="true">${Array.from({ length: 18 }, (_, i) => `<i style="--x:${10 + (i * 31 % 78)}%;--y:${27 + (i * 19 % 58)}%;--r:${i * 31}deg;--ball:${["#e7ac42", "#79a6a7", "#d47672", "#b8abce"][i % 4]}"></i>`).join("")}</div><div class="gacha-base"><small>每一颗，都有一点小四。</small><button class="gacha-draw" type="button" aria-label="转动扭蛋机"><span class="gacha-knob" aria-hidden="true"></span><b>转动一下</b></button><div class="gacha-chute" aria-hidden="true"><i></i></div><span class="gacha-serial">FREE PLAY · 不用投币</span></div></div></section><section class="gacha-story"><span class="gacha-edition">THE LITTLE COLLECTION</span><h1>偶遇一点<br>不一样的我<span>。</span></h1><p>转一下，把藏在电脑里的<br>作品、片段和故事带出来。</p><div class="gacha-result" role="status"><small>下一颗会是什么？</small><strong data-gacha-title>等你转动把手</strong><span data-gacha-note>没有付费、稀有度或抽取次数限制。</span><button type="button" data-result hidden>打开这颗扭蛋 ↗</button></div><div class="gacha-categories">作品 / 照片 / 视频 / 文章 / 趣事</div><div class="gacha-actions"><button type="button" data-collection>我的收藏 <b data-favorite-count>0</b></button><button type="button" data-catalog>${api.editMode ? "补充内容" : "内容目录"}</button></div><p class="arcade-muted" data-stock></p></section></div>`;
    let busy = false, current = null;
    refresh = () => {
      const ready = slots().filter(isReady).length;
      $("[data-stock]").textContent = ready ? `已上架 ${ready} / ${SLOT_DEFS.length} 个展位 · 本轮优先遇见未抽过的内容` : `内容正在补货 · ${SLOT_DEFS.length} 个展位已预留，可以先试转体验`;
      $("[data-favorite-count]").textContent = readProgress().favorites.filter(id => slots().some(s => s.id === id && isReady(s))).length;
    };
    on($(".gacha-draw"), "click", () => {
      if (busy) return; busy = true;
      $(".gacha-draw").disabled = true; $(".gacha-machine").classList.add("turning");
      $("[data-gacha-title]").textContent = "咔哒，正在掉落…"; $("[data-result]").hidden = true;
      later(() => {
        const cards = slots().filter(isReady), seen = readProgress().seen;
        current = drawCapsule(cards, seen);
        if (current) {
          remember("seen", cards.every(s => seen.includes(s.id)) ? [current.id] : [...seen, current.id]);
          $("[data-gacha-title]").textContent = current.title || current.label;
          $("[data-gacha-note]").textContent = `${current.kind} · 点击打开，看看里面有什么。`;
          $("[data-result]").hidden = false;
        } else {
          $("[data-gacha-title]").textContent = "机器就绪，故事正在补货。";
          $("[data-gacha-note]").textContent = api.editMode ? "点「补充内容」填好一个展位，就能抽到了。" : "这是一次空机试转，真实内容准备好后再来看看。";
        }
        $(".gacha-machine").classList.remove("turning"); $(".gacha-machine").classList.add("dispensed");
        $(".gacha-draw").disabled = false; busy = false; refresh();
      }, matchMedia("(prefers-reduced-motion: reduce)").matches ? 50 : 950);
    });
    on($("[data-result]"), "click", () => { if (current) showCard(current.id); });
    on($("[data-catalog]"), "click", () => showDirectory());
    on($("[data-collection]"), "click", () => showDirectory(readProgress().favorites.filter(id => slots().some(s => s.id === id && isReady(s))), "我的收藏"));
    refresh();
  } else {
    town = createTown(readProgress().defeated, readProgress());
    host.innerHTML = `<header class="town-toolbar"><strong><i></i> 小四小镇 <small>A LITTLE WORLD TO WANDER</small></strong><div><button type="button" data-town-map aria-pressed="false">地图 M</button><button type="button" data-town-journal>手册 J</button><button type="button" data-town-pause>暂停</button><button type="button" data-town-directory>内容目录</button><button type="button" data-town-help>玩法</button></div></header><div class="console-deck"><div class="town-screen"><canvas width="720" height="432" tabindex="0" aria-label="小四小镇。方向键或 WASD 移动，空格攻击，E 互动，M 地图，J 探索手册。内容目录可直接浏览全部展位。"></canvas><div class="town-hud"><span data-hp></span><span data-location>小镇广场</span><span data-chests></span></div><div class="town-pause" hidden><strong>稍作休息</strong><span>点击游戏画面继续探索</span></div></div><aside class="console-left"><div class="dpad" aria-label="移动控制"><button type="button" data-dir="ArrowUp" aria-label="向上">▲</button><button type="button" data-dir="ArrowLeft" aria-label="向左">◀</button><i></i><button type="button" data-dir="ArrowRight" aria-label="向右">▶</button><button type="button" data-dir="ArrowDown" aria-label="向下">▼</button></div><small>WASD / 方向键</small></aside><aside class="console-right"><div><button type="button" class="console-action action-a" data-attack aria-label="A 攻击">A</button><small>攻击</small></div><div><button type="button" class="console-action action-b" data-interact aria-label="B 互动">B</button><small>互动</small></div></aside><div class="town-discovery" role="status" hidden></div></div><footer class="town-footer"><span data-town-status role="status"></span><b data-discoveries>探索 0 / 8</b></footer>`;
    const canvas = $("canvas"), ctx = canvas.getContext("2d"), pauseScreen = $(".town-pause");
    loadTownArt().then(() => { if (!dead) delete canvas.dataset.drawn; }).catch(() => { if (!dead) api.notify("精细素材暂未加载，已使用基础画面，游戏仍可继续。"); });
    const screen = $(".town-screen");
    const fitScreen = new ResizeObserver(() => {
      if (!screen.clientWidth || !screen.clientHeight) return;
      const metrics = canvasMetrics(screen.clientWidth, screen.clientHeight, window.devicePixelRatio);
      canvas.width = metrics.width; canvas.height = metrics.height; canvas.dataset.scale = metrics.scale;
      ctx.imageSmoothingEnabled = true; delete canvas.dataset.drawn; town.camera = null;
    });
    fitScreen.observe(screen);
    abort.signal.addEventListener("abort", () => fitScreen.disconnect(), { once: true });
    let last = performance.now(), moveWait = 0, previousDefeated = town.defeated.length;
    const canPlay = () => !paused && !blurred && !sheet && !document.hidden && el.classList.contains("active") && !el.classList.contains("minimized") && !el.closest("[inert]") && !document.querySelector("dialog[open]");
    let discoveryToken = 0;
    const announce = message => {
      const token = ++discoveryToken, banner = $(".town-discovery");
      banner.textContent = message; banner.hidden = false;
      later(() => { if (token === discoveryToken) banner.hidden = true; }, 3000);
    };
    const journal = () => {
      openSheet("小镇探索手册", `<article class="town-journal"><p class="arcade-kicker">XIAOSI FIELD NOTES / NO. 004</p><h2>慢慢走，总会有小发现。</h2><p>拜访小屋、打开宝箱、认识路边的朋友。探索进度保存在当前浏览器。</p><div class="journal-grid">${HOUSES.map(h => `<section><span>${town.visited.includes(h.id) ? "✓ 已拜访" : "○ 等你敲门"}</span><h3>${esc(h.name)}</h3><p>走进房间，靠近展品按 E / B。</p></section>`).join("")}${town.monsters.map(m => `<section><span>${m.hp <= 0 ? "✓ 宝箱已解锁" : "○ 守卫还在"}</span><h3>${m.id === "forest" ? "森林宝箱" : "城堡宝箱"}</h3><p>三次攻击，留意蓄力预警。</p></section>`).join("")}${SECRET_SPOTS.map(s => `<section class="journal-secret"><span>${town.secrets.includes(s.id) ? "✦ 已发现" : "? 小镇传闻"}</span><h3>${town.secrets.includes(s.id) ? esc(s.title) : "尚未揭晓"}</h3><p>${esc(town.secrets.includes(s.id) ? "发现已记入手册，对应内容可在目录中查看。" : s.hint)}</p></section>`).join("")}</div></article>`);
    };
    const toggleMap = () => { if (!town.room) { town.overview = !town.overview; town.camera = null; delete canvas.dataset.drawn; $("[data-town-map]").setAttribute("aria-pressed", String(town.overview)); canvas.focus(); } };
    const interact = () => {
      if (!canPlay()) return;
      const destination = interactTown(town);
      if (!destination) { announce("走近房门、展品或小镇里的特别之处，再按 B / E。"); return; }
      if (HOUSES.some(h => h.id === destination.id)) { enterTownRoom(town, destination.id); town.overview = false; remember("visited", town.visited); }
      else if (destination.type === "exit") leaveTownRoom(town);
      else if (destination.type === "secret") {
        const result = discoverSecret(town, destination.id); remember("secrets", town.secrets);
        if (result.unlocked) { announce(`✦ 发现「${result.title}」`); showCard(result.slots[0]); }
        else announce(town.message);
      } else if (destination.slots?.length === 1) showCard(destination.slots[0]);
      else showDirectory(destination.slots, destination.name);
      $("[data-town-map]").setAttribute("aria-pressed", String(Boolean(town.overview)));
      $("[data-town-map]").disabled = Boolean(town.room);
    };
    on($("[data-town-map]"), "click", toggleMap);
    on($("[data-town-journal]"), "click", journal);
    on($("[data-town-directory]"), "click", () => showDirectory());
    on($("[data-town-help]"), "click", () => {
      openSheet("冒险手册", `<div class="town-help"><p class="arcade-kicker">没有倒计时，慢慢探索。</p><h2>把这台电脑，当成一个小世界。</h2><p>方向键 / WASD 移动；手机使用左侧十字键。</p><p>走到房门，按 <b>B / E</b> 进屋。三间房子分别放作品、影像和文章。</p><p>靠近守卫，按 <b>A / 空格</b> 攻击。每只守卫需要三次攻击；看到红色预警时，退开一格躲避。</p><p>击败守卫后，按 <b>B / E</b> 打开宝箱。森林和城堡宝箱各对应固定内容。失去全部爱心会回到广场，宝箱进度保留。</p><p>切换窗口、打开目录或离开页面时自动暂停。内容目录始终可以直接打开全部展位。</p>${api.editMode ? "<p>编辑模式：打开任意展位 → 编辑这个展位 → 上传素材 / 填写文字。</p>" : ""}<button type="button" data-replay>重新挑战两位守卫</button><p class="arcade-muted">只重置本游戏的挑战进度，不影响素材和收藏。</p></div>`);
      sheet.querySelector(".town-help").insertAdjacentHTML("beforeend", "<p>进屋后可以走动，靠近画框、书架或放映机按 E / B 查看展位；走到门口再按一次即可出门。按 M 看全镇地图，按 J 查看探索手册。小镇里还藏着三处小秘密。</p>");
      on($("[data-replay]"), "click", () => { remember("defeated", []); town = createTown([], readProgress()); previousDefeated = 0; $("[data-town-map]").disabled = false; $("[data-town-map]").setAttribute("aria-pressed", "false"); closeSheet(); });
    });
    on($("[data-town-pause]"), "click", () => { paused = !paused; held.clear(); $("[data-town-pause]").textContent = paused ? "继续" : "暂停"; });
    on(pauseScreen, "click", () => { paused = false; blurred = false; $("[data-town-pause]").textContent = "暂停"; canvas.focus(); });
    on(canvas, "pointerdown", () => canvas.focus({ preventScroll: true }));
    host.querySelectorAll("[data-dir]").forEach(button => {
      on(button, "pointerdown", event => { event.preventDefault(); if (!canPlay()) return; button.setPointerCapture(event.pointerId); held.add(button.dataset.dir); movePlayer(town, ...directions[button.dataset.dir]); moveWait = 0.18; });
      ["pointerup", "pointercancel", "lostpointercapture"].forEach(event => on(button, event, () => held.delete(button.dataset.dir)));
      on(button, "click", event => { if (event.detail === 0 && canPlay()) movePlayer(town, ...directions[button.dataset.dir]); });
    });
    on($("[data-attack]"), "click", () => { if (canPlay()) attackTown(town); });
    on($("[data-interact]"), "click", interact);
    on(document, "keydown", event => {
      if (!canPlay() || event.target.closest("input, textarea, select, button, a, [contenteditable]")) return;
      const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
      if (directions[key]) { event.preventDefault(); if (!held.has(key)) { movePlayer(town, ...directions[key]); moveWait = 0.18; } held.add(key); }
      if ([" ", "e"].includes(key)) { event.preventDefault(); if (!event.repeat) { if (key === "e") interact(); else attackTown(town); } }
      if (["m", "j"].includes(key) && !event.repeat) { event.preventDefault(); if (key === "m") toggleMap(); else journal(); }
    });
    on(document, "keyup", event => held.delete(event.key.length === 1 ? event.key.toLowerCase() : event.key));
    on(window, "blur", () => { held.clear(); blurred = true; });
    on(window, "focus", () => { blurred = false; });
    on(document, "visibilitychange", () => held.clear());
    on(window, "resize", () => held.clear());
    const observe = new MutationObserver(() => { if (!canPlay()) held.clear(); });
    observe.observe(el, { attributes: true, attributeFilter: ["class"] });
    abort.signal.addEventListener("abort", () => observe.disconnect(), { once: true });
    const loop = now => {
      if (dead) return;
      const dt = Math.min((now - last) / 1000, 0.05); last = now;
      const playing = canPlay();
      pauseScreen.hidden = playing || Boolean(sheet);
      if (playing) {
        moveWait -= dt;
        if (held.size && moveWait <= 0) { movePlayer(town, ...directions[[...held].at(-1)]); moveWait = 0.13; }
        tickTown(town, dt);
      } else held.clear();
      if (town.defeated.length !== previousDefeated) {
        remember("defeated", [...readProgress().defeated, ...town.defeated]); previousDefeated = town.defeated.length;
      }
      if (playing || !canvas.dataset.drawn) { drawTown(ctx, town, matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : now / 1000); canvas.dataset.drawn = "1"; }
      $("[data-hp]").textContent = "♥".repeat(town.player.hp) + "♡".repeat(4 - town.player.hp);
      $("[data-chests]").textContent = `宝箱 ${town.defeated.length} / 2`;
      $("[data-location]").textContent = HOUSES.find(h => h.id === town.room)?.name || (town.overview ? "小镇全景 · M 返回" : "小四小镇 · 微风晴日");
      $("[data-discoveries]").textContent = `探索 ${town.visited.length + town.defeated.length + town.secrets.length} / 8`;
      const near = interactTown(town);
      const message = near ? `B / E · ${near.name}` : town.message;
      if ($("[data-town-status]").textContent !== message) $("[data-town-status]").textContent = message;
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
  }
  return () => {
    dead = true; abort.abort(); timers.forEach(clearTimeout); cancelAnimationFrame(frame); cleanupMedia(); held.clear();
  };
}
