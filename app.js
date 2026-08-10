import { DEFAULT_CONTENT } from "./content.js";

const STORAGE_KEY = "xiaosi-os-content-v2";
const DB_NAME = "xiaosi-os-assets";
const QUEST_KEY = "xiaosi-os-quest-v1";
const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];
const esc = (v = "") => String(v).replace(/[&<>'"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[c]));

let content = loadContent();
let z = 100;
let cascade = 0;
const windows = new Map();
const assetUrls = new Map();
const editMode = new URLSearchParams(location.search).has("edit");
let spill = null;
const completed = new Set(JSON.parse(localStorage.getItem(QUEST_KEY) || "[]"));

const QUESTS = [
  ["about", "查看 About Me"],
  ["folder-0", "翻翻项目一文件夹"],
  ["folder-1", "翻翻项目二文件夹"],
  ["folder-2", "翻翻项目三文件夹"],
  ["portrait", "点一下壁纸里探头的小四"],
  ["mines", "玩一局 Minesweeper"],
  ["recycle", "翻翻回收站里的旧想法"]
];

const iconDefs = [
  ["about", "About Me", "🖥️"],
  ["readme", "README.txt", "📝"],
  ["mines", "Minesweeper", "💣"],
  ["recycle", "Recycle Bin", "🗑️"],
  ["internet", "Internet", "🌐"],
  ["folder:0", () => content.projects[0].shortTitle, "📁"],
  ["folder:1", () => content.projects[1].shortTitle, "📁"],
  ["folder:2", () => content.projects[2].shortTitle, "📁"],
  ["contact", "联系我", "✉️"],
  ["guestbook", "留言簿", "🖼️"]
];

function loadContent() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return saved ? { ...structuredClone(DEFAULT_CONTENT), ...saved } : structuredClone(DEFAULT_CONTENT);
  } catch {
    return structuredClone(DEFAULT_CONTENT);
  }
}

function bindContent() {
  $$('[data-bind]').forEach((el) => { el.textContent = content[el.dataset.bind] || ""; });
  document.title = `${content.systemName} · ${content.ownerName}`;
}

function glyph(char) {
  return `<span class="glyph" aria-hidden="true">${char}</span>`;
}

function renderDesktop() {
  const host = $("#desktop-icons");
  host.innerHTML = iconDefs.map(([id, label, icon]) => {
    const text = typeof label === "function" ? label() : label;
    return `<li><button class="desktop-icon" data-open="${id}" type="button">${glyph(icon)}<span>${esc(text)}</span></button></li>`;
  }).join("");

  $$(".desktop-icon", host).forEach((button) => {
    button.addEventListener("click", () => {
      $$(".desktop-icon", host).forEach((el) => el.classList.remove("selected"));
      button.classList.add("selected");
      if (matchMedia("(pointer: coarse)").matches) activateDesktop(button.dataset.open, button);
    });
    button.addEventListener("dblclick", () => activateDesktop(button.dataset.open, button));
    button.addEventListener("keydown", (event) => {
      if (event.key === "Enter") activateDesktop(button.dataset.open, button);
    });
  });

  const list = $("#start-list");
  list.innerHTML = iconDefs.slice(0, 9).map(([id, label, icon]) => {
    const text = typeof label === "function" ? label() : label;
    return `<li><button type="button" data-open="${id}">${glyph(icon)}<span>${esc(text)}</span></button></li>`;
  }).join("") + `<li class="separator"></li><li><button type="button" data-shutdown>${glyph("⏻")}<span>关机</span></button></li>`;
  $$('[data-open]', list).forEach((button) => button.addEventListener("click", () => {
    toggleStart(false);
    const anchor = $(`.desktop-icon[data-open="${CSS.escape(button.dataset.open)}"]`);
    activateDesktop(button.dataset.open, anchor);
  }));
  $('[data-shutdown]', list).addEventListener("click", shutdown);
}

function activateDesktop(id, anchor) {
  if (id === "about") {
    closeSpill();
    questDone("about");
    openResumeBomb();
    return;
  }
  if (id.startsWith("folder:")) {
    const index = Number(id.split(":")[1]);
    questDone(`folder-${index}`);
    toggleSpill(anchor, index);
    return;
  }
  closeSpill();
  if (id === "mines") questDone("mines");
  if (id === "recycle") questDone("recycle");
  openWindow(id);
}

function closeSpill() {
  if (!spill) return;
  spill.classList.add("closing");
  const old = spill;
  spill = null;
  setTimeout(() => old.remove(), 180);
}

function toggleSpill(anchor, index) {
  if (!anchor) { openWindow(`project:${index}`); return; }
  if (spill?.dataset.index === String(index)) { closeSpill(); return; }
  closeSpill();
  const project = content.projects[index];
  const items = [
    ["case", "★ CASE", "完整案例", `project:${index}`, "hero"],
    ["research", "↗", "调研与洞察", `project-note:${index}:research`, "gallery-1"],
    ["strategy", "↗", "品牌策略", `project-note:${index}:strategy`, "gallery-2"],
    ["visual", "↗", "视觉系统", `gallery:${index}`, "gallery-3"],
    ["campaign", "↗", "传播活动", `project-note:${index}:campaign`, "gallery-4"],
    ["gallery", "↗", "图片集", `gallery:${index}`, "gallery-5"],
    ["video", "▶", "Video", `video:${index}`, "hero"],
    ["proof", "↗", "证据档案", `project-note:${index}:proof`, "gallery-1"]
  ];
  const desktopRect = $("#desktop").getBoundingClientRect();
  const rect = anchor.getBoundingClientRect();
  const host = document.createElement("div");
  host.className = "project-spill";
  host.dataset.index = index;
  host.style.left = `${Math.min(rect.right - desktopRect.left + 18, innerWidth - 210)}px`;
  host.style.top = `${Math.max(10, rect.top - desktopRect.top)}px`;
  host.innerHTML = items.map(([kind, badge, label, target, asset], itemIndex) => `<button class="spill-item${kind === "case" ? " featured" : ""}" style="--delay:${itemIndex * 35}ms;--accent:${project.accent}" data-target="${target}" type="button"><span class="spill-thumb has-image" data-asset="project-${index}-${asset}" style="${assetStyle(project.assets?.[asset])}"><i>${badge}</i></span><b>${esc(label)}</b></button>`).join("");
  $("#desktop").append(host);
  spill = host;
  $$(".spill-item", host).forEach((button) => {
    const open = () => { closeSpill(); openWindow(button.dataset.target); };
    button.addEventListener("dblclick", open);
    if (matchMedia("(pointer: coarse)").matches) button.addEventListener("click", open);
  });
  hydrateAssets(host);
}

function windowSpec(key) {
  if (key === "about") return { title: "About Me", icon: "🖥️", width: 720, body: aboutHTML() };
  if (key === "readme") return { title: "README.txt - Notepad", icon: "📝", width: 600, body: readmeHTML() };
  if (key === "contact") return { title: "Contact", icon: "✉️", width: 500, body: contactHTML() };
  if (key === "recycle") return { title: "Recycle Bin", icon: "🗑️", width: 560, body: recycleHTML() };
  if (key === "internet") return { title: `${content.nickname} Explorer`, icon: "🌐", width: 760, body: browserHTML() };
  if (key === "guestbook") return { title: "留言簿", icon: "🖼️", width: 600, body: guestbookHTML() };
  if (key === "mines") return { title: "Minesweeper", icon: "💣", width: 360, body: minesHTML() };
  if (key.startsWith("project-note:")) {
    const [, index, section] = key.split(":");
    const project = content.projects[Number(index)];
    return { title: `${project.shortTitle} · ${project.sections[section].title}`, icon: "📄", width: 720, body: projectNoteHTML(project, section) };
  }
  if (key.startsWith("gallery:")) {
    const index = Number(key.split(":")[1]);
    return { title: `${content.projects[index].title} · 图片集`, icon: "🖼️", width: 860, body: galleryHTML(content.projects[index], index) };
  }
  if (key.startsWith("video:")) {
    const index = Number(key.split(":")[1]);
    return { title: `Windows Media Player · ${content.projects[index].title}`, icon: "▶️", width: 720, body: videoHTML(content.projects[index], index) };
  }
  if (key.startsWith("resume:")) return resumeSpec(key);
  if (key.startsWith("project:")) {
    const index = Number(key.split(":")[1]);
    return { title: content.projects[index].title, icon: "📁", width: 1040, full: true, body: projectHTML(content.projects[index], index) };
  }
  return { title: key, icon: "📄", width: 480, body: "" };
}

function resumeSpec(key) {
  const index = Number(key.split(":")[1]);
  const specs = [
    { title: `${content.ownerName} · ${content.nickname}`, width: 510, body: `<div class="resume-story"><p class="eyebrow">${esc(content.role)}</p><h1>${esc(content.tagline)}</h1><p>${esc(content.intro)}</p><mark>先理解真实的人和场景，再做策略；先把策略做成行动，再谈结果。</mark></div>` },
    { title: `Project · ${content.projects[0].title}`, width: 380, body: resumeProjectHTML(0) },
    { title: `Project · ${content.projects[1].title}`, width: 360, body: resumeProjectHTML(1) },
    { title: `Project · ${content.projects[2].title}`, width: 360, body: resumeProjectHTML(2) },
    { title: "Toolbox", width: 330, body: `<div class="toolbox-grid">${content.skills.map((s, i) => `<span><i>${["✦", "⌘", "AI", "◫", "↗"][i] || "•"}</i>${esc(s)}</span>`).join("")}</div>` },
    { title: `Output · ${content.outputs[0].title}`, width: 500, body: resumeOutputHTML(content.outputs[0]) },
    { title: `Output · ${content.outputs[1].title}`, width: 500, body: resumeOutputHTML(content.outputs[1]) },
    { title: `${content.nickname}.jpg · 点色块换背景`, width: 300, body: `<div class="photo-lab"><img data-asset="profile" src="assets/profile-xiaosi.jpg" alt=""><div>${["#2f7b35", "#245edb", "#f2c33d", "#e24a36", "#7656d8"].map(c => `<button type="button" style="--swatch:${c}" data-swatch="${c}"></button>`).join("")}</div></div>` }
  ];
  return { ...specs[index], icon: index === 7 ? "🖼️" : "📄", resume: true, noTask: true };
}

function openResumeBomb() {
  if (innerWidth < 720) { openWindow("about"); return; }
  const positions = [[36,8],[66,6],[5,12],[15,31],[38,48],[65,50],[61,13],[21,9]];
  positions.forEach(([x, y], index) => setTimeout(() => {
    const el = openWindow(`resume:${index}`);
    if (!el) return;
    el.style.left = `${Math.min(innerWidth - el.offsetWidth - 10, innerWidth * x / 100)}px`;
    el.style.top = `${Math.min(innerHeight - el.offsetHeight - 44, innerHeight * y / 100)}px`;
  }, index * 115));
}

function aboutHTML() {
  return `<div class="about-layout">
    <figure><img data-asset="profile" src="assets/profile-xiaosi.jpg" alt="${esc(content.ownerName)}"><figcaption>${esc(content.nickname)}</figcaption></figure>
    <section><p class="eyebrow">HELLO, I AM</p><h1>${esc(content.ownerName)}</h1><h2>${esc(content.nickname)} · ${esc(content.role)}</h2><p class="lead">${esc(content.tagline)}</p><p>${esc(content.intro)}</p><ul class="skill-list">${content.skills.map((s) => `<li>${esc(s)}</li>`).join("")}</ul></section>
    <div class="about-outputs"><h3>精选产出</h3>${content.outputs.map((output) => `<article><b>${esc(output.title)}</b><p>${esc(output.bullets[0])}</p></article>`).join("")}</div>
  </div>`;
}

function readmeHTML() {
  return `<div class="notepad"><div class="notepad-menu">文件(F)　编辑(E)　格式(O)　查看(V)　帮助(H)</div><div class="note-paper"><h2>欢迎进入小四的个人电脑。</h2><p>${esc(content.tagline)}</p><div class="quest-panel">${questHTML()}</div><p class="note-end">作品会继续增加，现有图片与文字也都可以替换。</p><p class="edit-tip">需要补素材时，在网址末尾加 <code>?edit=1</code>。</p></div></div>`;
}

function questHTML() {
  const done = QUESTS.filter(([id]) => completed.has(id)).length;
  return `<h3>逛这台 ${esc(content.systemName)}，逛到就自动打勾</h3><ul>${QUESTS.map(([id, label]) => `<li class="${completed.has(id) ? "done" : ""}"><i>${completed.has(id) ? "✓" : ""}</i>${esc(label)}</li>`).join("")}</ul><div class="quest-progress"><span style="width:${done / QUESTS.length * 100}%"></span><b>${done}/${QUESTS.length}</b></div>`;
}

function questDone(id) {
  if (completed.has(id)) return;
  completed.add(id);
  localStorage.setItem(QUEST_KEY, JSON.stringify([...completed]));
  const panel = $('[data-key="readme"] .quest-panel');
  if (panel) panel.innerHTML = questHTML();
  if (completed.size === QUESTS.length) showToast("探索任务全部完成，XIAOSI-OS 已通关！");
}

function contactHTML() {
  return `<div class="text-pane"><h2>联系 ${esc(content.nickname)}</h2><pre>${esc(content.contact)}</pre><p>以上内容暂为占位，不会自动对外发送。</p></div>`;
}

function recycleHTML() {
  return `<div class="recycle-grid"><button><span>🗒️</span><b>失败草稿.txt</b></button><button><span>📦</span><b>过期想法.zip</b></button><button><span>🧩</span><b>以后再做.exe</b></button></div>`;
}

function browserHTML() {
  return `<div class="browser"><div class="browser-tools"><button data-browser-back>←</button><button>→</button><button data-browser-home>⌂</button><label>地址 <input class="browser-url" value="https://xiaosi.local"></label></div><div class="browser-bookmarks">${content.projects.map((p, i) => `<button data-browser-project="${i}">${esc(p.shortTitle)}</button>`).join("")}</div><div class="browser-home"><div class="old-logo">Xiao<i>s</i>i</div><input class="browser-search" aria-label="搜索项目"><div><button data-browser-search>搜索</button><button data-browser-lucky>随机项目</button></div><p>从三个代表项目开始，也可以等待后续补充公开文章与外部作品链接。</p></div></div>`;
}

function guestbookHTML() {
  return `<div class="guestbook"><h2>给小四留句话</h2><p>这是留言功能的视觉占位。正式上线前需要接入数据库或表单服务。</p><label>你的名字<input disabled placeholder="待接入"></label><label>留言<textarea disabled placeholder="待接入"></textarea></label><button disabled>发送</button></div>`;
}

function assetStyle(src) {
  return src ? `background-image:url('${esc(src)}')` : "";
}

function projectHTML(project, index) {
  const slot = (name, label) => {
    const src = project.assets?.[name];
    return `<button class="upload-slot ${name}${src ? " has-image" : ""}" type="button" style="${assetStyle(src)}" data-asset="project-${index}-${name}" data-upload-key="project-${index}-${name}"><span>＋</span><b>${label}</b><small>${editMode ? "点击替换图片" : "素材待补充"}</small></button>`;
  };
  return `<article class="case-study" style="--project-accent:${project.accent}">
    <div class="case-hero">${slot("hero", "项目封面")}</div>
    <header><p>PROJECT 0${index + 1}</p><h1>${esc(project.title).replace(" · ", "<br>")}</h1><h2>${esc(project.meta)}</h2><div class="case-rule"></div><p>${esc(project.summary)}</p></header>
    <div class="case-gallery">${slot("gallery-1", "调研与洞察")}${slot("gallery-2", "品牌策略")}${slot("gallery-3", "视觉系统")}</div>
  </article>`;
}

function galleryHTML(project, index) {
  const slots = ["hero", "gallery-1", "gallery-2", "gallery-3", "gallery-4", "gallery-5"];
  return `<div class="gallery-window"><header><p>IMAGE FOLDER</p><h2>${esc(project.title)}</h2></header><div>${slots.map((name, i) => {
    const src = project.assets?.[name];
    return `<button class="upload-slot${src ? " has-image" : ""}" type="button" style="${assetStyle(src)}" data-asset="project-${index}-${name}" data-upload-key="project-${index}-${name}"><span>＋</span><b>${i === 0 ? "项目封面" : `图片 ${i}`}</b><small>${editMode ? "点击替换" : "素材待补充"}</small></button>`;
  }).join("")}</div></div>`;
}

function projectNoteHTML(project, sectionKey) {
  const section = project.sections[sectionKey];
  return `<article class="case-note" style="--project-accent:${project.accent}"><p>${esc(project.shortTitle)} / ${esc(sectionKey.toUpperCase())}</p><h1>${esc(section.title)}</h1><strong>${esc(section.lead)}</strong><ul>${section.bullets.map((item) => `<li>${esc(item)}</li>`).join("")}</ul><button type="button" data-open-project="${content.projects.indexOf(project)}">打开完整案例</button></article>`;
}

function videoHTML(project, index) {
  return `<div class="wmp"><div class="wmp-menu">File　View　Play　Tools　Help</div><div class="wmp-screen" data-video-screen="project-${index}-video"><span>▶</span><b>${esc(project.title)}</b><small>${editMode ? "点击选择本地视频" : "视频待补充"}</small></div><div class="wmp-controls"><button>▶</button><button>■</button><input type="range" value="0" disabled><span>0:00 / 0:00</span></div></div>`;
}

function resumeProjectHTML(index) {
  const project = content.projects[index];
  return `<div class="resume-project" style="--project-accent:${project.accent}"><div data-asset="project-${index}-hero" style="${assetStyle(project.assets?.hero)}"></div><h2>${esc(project.title)}</h2><p>${esc(project.meta)}</p><small>${esc(project.summary)}</small><button type="button" data-open-project="${index}">打开完整案例</button></div>`;
}

function resumeOutputHTML(output) {
  return `<div class="resume-output"><img src="${esc(output.image)}" alt="${esc(output.alt)}"><section><p>${esc(output.label)}</p><b>${esc(output.title)}</b><ul>${output.bullets.map((item) => `<li>${esc(item)}</li>`).join("")}</ul></section></div>`;
}

function minesHTML() {
  return `<div class="mines"><div class="mines-menu">Game　Help</div><div class="mines-score"><b>010</b><button class="mine-reset" type="button">🙂</button><b>000</b></div><div class="mine-grid" role="grid"></div><p>左键翻开 · 右键插旗</p></div>`;
}

function openWindow(key) {
  if (windows.has(key)) {
    const existing = windows.get(key);
    existing.classList.remove("minimized");
    focusWindow(existing);
    return existing;
  }
  const spec = windowSpec(key);
  const el = document.createElement("section");
  el.className = `xp-window${spec.full ? " full-window" : ""}${spec.resume ? " resume-card" : ""}`;
  el.dataset.key = key;
  el.style.width = `${Math.min(spec.width, innerWidth - 20)}px`;
  el.innerHTML = `<header class="titlebar">${glyph(spec.icon)}<strong>${esc(spec.title)}</strong><span><button data-min aria-label="最小化">–</button><button data-max aria-label="最大化">□</button><button data-close aria-label="关闭">×</button></span></header><div class="window-body">${spec.body}</div>`;
  $("#window-layer").append(el);
  if (!spec.full) {
    el.style.left = `${Math.max(8, Math.min(72 + cascade * 26, innerWidth - el.offsetWidth - 12))}px`;
    el.style.top = `${Math.max(8, Math.min(42 + cascade * 18, innerHeight - el.offsetHeight - 46))}px`;
    cascade = (cascade + 1) % 6;
  }
  windows.set(key, el);
  wireWindow(el, key, spec);
  makeDraggable($(".titlebar", el), el);
  if (!spec.noTask) addTaskItem(key, spec);
  focusWindow(el);
  hydrateAssets(el);
  return el;
}

function wireWindow(el, key) {
  $('[data-close]', el).addEventListener("click", () => closeWindow(key));
  $('[data-min]', el).addEventListener("click", () => minimizeWindow(key));
  $('[data-max]', el).addEventListener("click", () => maximizeWindow(key));
  $(".titlebar", el).addEventListener("dblclick", (event) => { if (!event.target.closest("button")) maximizeWindow(key); });
  el.addEventListener("pointerdown", () => focusWindow(el));
  if (key === "mines") initMines(el);
  if (key.startsWith("project:") || key.startsWith("gallery:")) initProjectUploads(el);
  if (key.startsWith("video:")) initVideoUpload(el, key);
  if (key === "internet") initBrowser(el);
  if (key.startsWith("resume:") || key.startsWith("project-note:")) initResumeCard(el);
}

function initBrowser(el) {
  $$('[data-browser-project]', el).forEach((button) => button.addEventListener("click", () => openWindow(`project:${button.dataset.browserProject}`)));
  $('[data-browser-lucky]', el).addEventListener("click", () => openWindow(`project:${Math.floor(Math.random() * content.projects.length)}`));
  const search = () => {
    const value = $('.browser-search', el).value.trim();
    if (!value) return;
    const match = content.projects.findIndex((project) => `${project.title} ${project.summary}`.includes(value));
    if (match >= 0) openWindow(`project:${match}`);
    else $('.browser-home p', el).textContent = `没有找到“${value}”。可以试试：挂面村、红旗、三九胃泰、直播。`;
  };
  $('[data-browser-search]', el).addEventListener("click", search);
  $('.browser-search', el).addEventListener("keydown", (event) => { if (event.key === "Enter") search(); });
}

function initResumeCard(el) {
  $('[data-open-project]', el)?.addEventListener("click", (event) => openWindow(`project:${event.currentTarget.dataset.openProject || 0}`));
  $$('[data-swatch]', el).forEach((button) => button.addEventListener("click", () => $('.photo-lab', el).style.background = button.dataset.swatch));
}

function initVideoUpload(el, key) {
  const screen = $('[data-video-screen]', el);
  screen.addEventListener("click", () => {
    if (!editMode) { showToast("在网址末尾加 ?edit=1 后即可上传视频"); return; }
    const input = document.createElement("input");
    input.type = "file"; input.accept = "video/*";
    input.addEventListener("change", async () => {
      const file = input.files[0]; if (!file) return;
      await saveAsset(screen.dataset.videoScreen, file);
      const url = URL.createObjectURL(file);
      screen.innerHTML = `<video src="${url}" controls autoplay></video>`;
    });
    input.click();
  });
}

function focusWindow(el) {
  $$(".xp-window.active").forEach((w) => w.classList.remove("active"));
  el.classList.add("active");
  el.style.zIndex = ++z;
  $$(".task-item").forEach((b) => b.classList.toggle("active", b.dataset.key === el.dataset.key));
}

function closeWindow(key) {
  windows.get(key)?.remove();
  windows.delete(key);
  $(`.task-item[data-key="${CSS.escape(key)}"]`)?.remove();
}

function minimizeWindow(key) {
  const el = windows.get(key);
  if (!el) return;
  el.classList.add("minimized");
  $(`.task-item[data-key="${CSS.escape(key)}"]`)?.classList.remove("active");
}

function maximizeWindow(key) {
  const el = windows.get(key);
  if (!el) return;
  el.classList.toggle("maximized");
  focusWindow(el);
}

function addTaskItem(key, spec) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "task-item active";
  button.dataset.key = key;
  button.innerHTML = `${glyph(spec.icon)}<span>${esc(spec.title)}</span>`;
  button.addEventListener("click", () => {
    const el = windows.get(key);
    if (el.classList.contains("minimized")) { el.classList.remove("minimized"); focusWindow(el); }
    else if (button.classList.contains("active")) minimizeWindow(key);
    else focusWindow(el);
  });
  $("#task-items").append(button);
}

function makeDraggable(handle, el) {
  let start;
  handle.addEventListener("pointerdown", (event) => {
    if (event.target.closest("button") || el.classList.contains("maximized")) return;
    start = { x: event.clientX, y: event.clientY, left: el.offsetLeft, top: el.offsetTop };
    handle.setPointerCapture(event.pointerId);
  });
  handle.addEventListener("pointermove", (event) => {
    if (!start) return;
    el.style.left = `${Math.max(20 - el.offsetWidth, Math.min(innerWidth - 40, start.left + event.clientX - start.x))}px`;
    el.style.top = `${Math.max(0, Math.min(innerHeight - 72, start.top + event.clientY - start.y))}px`;
  });
  handle.addEventListener("pointerup", () => { start = null; });
}

function initMines(el) {
  const grid = $(".mine-grid", el);
  const mines = new Set([3, 11, 17, 28, 39, 43, 55, 68, 74, 79]);
  const cells = Array.from({ length: 81 }, (_, i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.dataset.index = i;
    b.addEventListener("click", () => reveal(b));
    b.addEventListener("contextmenu", (event) => { event.preventDefault(); if (!b.classList.contains("open")) b.textContent = b.textContent ? "" : "🚩"; });
    grid.append(b);
    return b;
  });
  const count = (i) => {
    const row = Math.floor(i / 9), col = i % 9;
    let n = 0;
    for (let y = -1; y <= 1; y++) for (let x = -1; x <= 1; x++) {
      const r = row + y, c = col + x;
      if (r >= 0 && r < 9 && c >= 0 && c < 9 && mines.has(r * 9 + c)) n++;
    }
    return n;
  };
  const reveal = (button) => {
    const i = Number(button.dataset.index);
    if (mines.has(i)) { button.textContent = "💣"; button.classList.add("open", "boom"); showToast("踩雷了，再来一次吧。"); return; }
    button.classList.add("open");
    const n = count(i);
    button.textContent = n || "";
    if (n) button.dataset.n = n;
  };
  $(".mine-reset", el).addEventListener("click", () => cells.forEach((b) => { b.className = ""; b.textContent = ""; delete b.dataset.n; }));
}

function initProjectUploads(el) {
  $$('[data-upload-key]', el).forEach((slot) => slot.addEventListener("click", () => {
    if (!editMode) { showToast("在网址末尾加 ?edit=1 后即可上传素材"); return; }
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.addEventListener("change", async () => {
      const file = input.files[0];
      if (!file) return;
      await saveAsset(slot.dataset.uploadKey, file);
      applyAsset(slot.dataset.uploadKey, file);
      showToast("图片已保存在这台浏览器中");
    });
    input.click();
  }));
}

function toggleStart(force) {
  const menu = $("#start-menu");
  const open = force ?? menu.hidden;
  menu.hidden = !open;
  $("#start-button").classList.toggle("open", open);
  $("#start-button").setAttribute("aria-expanded", String(open));
}

function initEditor() {
  if (!editMode) return;
  $("#edit-entry").hidden = false;
  $("#edit-entry").addEventListener("click", () => { $("#editor").hidden = false; fillEditor(); });
  $("#editor-close").addEventListener("click", () => { $("#editor").hidden = true; });
  $("#editor-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);
    ["systemName", "ownerName", "nickname", "tagline", "intro", "contact"].forEach((key) => { content[key] = String(fd.get(key) || "").trim(); });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(content));
    bindContent();
    renderDesktop();
    showToast("文字已保存");
  });
  $("#export-content").addEventListener("click", exportContent);
  $("#wallpaper-upload").addEventListener("change", (event) => uploadGlobal("wallpaper", event.target.files[0]));
  $("#profile-upload").addEventListener("change", (event) => uploadGlobal("profile", event.target.files[0]));
}

function fillEditor() {
  const form = $("#editor-form");
  ["systemName", "ownerName", "nickname", "tagline", "intro", "contact"].forEach((key) => { form.elements[key].value = content[key] || ""; });
}

async function uploadGlobal(key, file) {
  if (!file) return;
  await saveAsset(key, file);
  applyAsset(key, file);
  showToast("图片已保存在这台浏览器中");
}

function exportContent() {
  const blob = new Blob([JSON.stringify(content, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement("a"), { href: url, download: "xiaosi-os-content.json" });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 500);
}

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore("assets");
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function saveAsset(key, blob) {
  const db = await openDB();
  await new Promise((resolve, reject) => {
    const req = db.transaction("assets", "readwrite").objectStore("assets").put(blob, key);
    req.onsuccess = resolve;
    req.onerror = () => reject(req.error);
  });
  db.close();
}

async function getAsset(key) {
  const db = await openDB();
  const value = await new Promise((resolve, reject) => {
    const req = db.transaction("assets").objectStore("assets").get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return value;
}

function applyAsset(key, blob) {
  if (assetUrls.has(key)) URL.revokeObjectURL(assetUrls.get(key));
  const url = URL.createObjectURL(blob);
  assetUrls.set(key, url);
  if (key === "wallpaper") $("#desktop").style.backgroundImage = `url("${url}")`;
  else if (key === "profile") $$('[data-asset="profile"]').forEach((img) => { img.src = url; });
  else $$(`[data-asset="${CSS.escape(key)}"]`).forEach((slot) => {
    slot.style.backgroundImage = `url("${url}")`;
    slot.classList.add("has-image");
  });
}

async function hydrateAssets(root = document) {
  const keys = new Set($$('[data-asset]', root).map((el) => el.dataset.asset));
  if (root === document) { keys.add("wallpaper"); keys.add("profile"); }
  for (const key of keys) {
    try { const blob = await getAsset(key); if (blob) applyAsset(key, blob); } catch { /* IndexedDB may be unavailable in private mode. */ }
  }
}

function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.hidden = false;
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => { toast.hidden = true; }, 2600);
}

function shutdown() {
  toggleStart(false);
  $("#desktop").classList.add("shutdown");
  setTimeout(() => location.reload(), 900);
}

function startClock() {
  const tick = () => { $("#clock").textContent = new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false }); };
  tick();
  setInterval(tick, 15000);
}

function enterDesktop() {
  $("#boot").classList.add("leaving");
  setTimeout(() => {
    $("#boot").hidden = true;
    $("#desktop").hidden = false;
    $("#desktop").classList.add("power-on");
    setTimeout(() => $("#desktop").classList.remove("power-on"), 700);
    setTimeout(() => { $("#welcome").hidden = false; }, 1200);
  }, 360);
}

bindContent();
renderDesktop();
startClock();
initEditor();
hydrateAssets();

$("#start-button").addEventListener("click", (event) => { event.stopPropagation(); toggleStart(); });
$("#welcome button").addEventListener("click", () => { $("#welcome").hidden = true; });
$("#welcome").addEventListener("click", (event) => { if (!event.target.closest("button")) { openWindow("readme"); $("#welcome").hidden = true; } });
$("#portrait-spot").addEventListener("click", () => {
  if ($("#desktop").classList.contains("portrait-gone")) return;
  $("#desktop").classList.add("portrait-gone");
  questDone("portrait");
  showToast("小四离开桌面去补作品素材了。");
});
document.addEventListener("click", (event) => { if (!event.target.closest("#start-menu, #start-button")) toggleStart(false); });
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") { toggleStart(false); $("#editor").hidden = true; }
  if (!$("#boot").hidden) enterDesktop();
});
$("#boot").addEventListener("click", enterDesktop, { once: true });
setTimeout(() => { if (!$("#boot").hidden) enterDesktop(); }, 4200);
