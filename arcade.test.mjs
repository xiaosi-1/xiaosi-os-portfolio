import test from "node:test";
import assert from "node:assert/strict";

const core = await import("./arcade-core.js").catch(() => ({}));

test("empty supply does not produce a pretend reward", () => {
  assert.equal(typeof core.drawCapsule, "function", "capsule drawing is not implemented");
  assert.equal(core.drawCapsule([], [], () => 0), null);
});

test("capsules exhaust unseen content before starting another round", () => {
  assert.equal(typeof core.drawCapsule, "function");
  const cards = [{ id: "a" }, { id: "b" }];
  assert.equal(core.drawCapsule(cards, ["a"], () => 0).id, "b");
  assert.equal(core.drawCapsule(cards, ["a", "b"], () => 0).id, "a");
});

test("unfilled slots stay empty and imported content cannot replace destination IDs", () => {
  assert.equal(typeof core.contentSlots, "function");
  const slots = core.contentSlots({ "work-1": { id: "bad", title: "我的作品", body: "说明" } });
  assert.equal(slots.find(s => s.id === "work-1").title, "我的作品");
  assert.equal(slots.some(s => s.id === "bad"), false);
  assert.equal(slots.filter(core.isReady).length, 1);
  assert.equal(core.safeLink("javascript:alert(1)"), "");
  assert.equal(core.safeLink("https://example.com/work"), "https://example.com/work");
});

test("player cannot walk through buildings or outside the map", () => {
  assert.equal(typeof core.createTown, "function");
  const s = core.createTown();
  s.player.x = 5; s.player.y = 8;
  core.movePlayer(s, 0, -1);
  assert.deepEqual([s.player.x, s.player.y], [5, 8]);
  s.player.x = 1; s.player.y = 10;
  core.movePlayer(s, -1, 0);
  assert.equal(s.player.x, 1);
});

test("three doors offer their own content, remote interaction offers nothing", () => {
  assert.equal(typeof core.interactTown, "function");
  const s = core.createTown();
  assert.equal(core.interactTown(s), null);
  for (const [x, y, id] of [[5, 8, "workshop"], [14, 7, "cinema"], [24, 8, "library"]]) {
    s.player.x = x; s.player.y = y;
    assert.equal(core.interactTown(s).id, id);
  }
});

test("only nearby attacks damage guardians and each treasure maps to a fixed slot", () => {
  assert.equal(typeof core.attackTown, "function");
  const s = core.createTown();
  core.attackTown(s);
  assert.equal(s.monsters[0].hp, 3);
  for (const [index, slot] of [[0, "forest-reward"], [1, "castle-reward"]]) {
    const m = s.monsters[index];
    s.player.x = m.x - 1; s.player.y = m.y;
    for (let i = 0; i < 3; i++) { s.attackCooldown = 0; core.attackTown(s); }
    assert.equal(m.hp, 0);
    const reward = core.interactTown(s);
    assert.equal(reward.slots[0], slot);
    assert.ok(s.defeated.includes(m.id));
  }
});

test("guardians warn before contact damage; defeat respawns player without losing discoveries", () => {
  assert.equal(typeof core.tickTown, "function");
  const s = core.createTown(["castle"]);
  s.player.x = 6; s.player.y = 14;
  core.tickTown(s, 0.1);
  assert.equal(s.player.hp, 4);
  core.tickTown(s, 0.8);
  assert.equal(s.player.hp, 3);
  s.player.hp = 1; s.invulnerable = 0;
  core.tickTown(s, 0.8);
  assert.equal(s.player.hp, 4);
  assert.deepEqual([s.player.x, s.player.y], [15, 11]);
  assert.ok(s.defeated.includes("castle"));
});

test("guardian progress can be restored without trusting invalid saved IDs", () => {
  assert.equal(typeof core.createTown, "function");
  const s = core.createTown(["forest", "unknown", "forest"]);
  assert.deepEqual(s.defeated, ["forest"]);
  assert.equal(s.monsters[0].hp, 0);
  assert.equal(s.monsters[1].hp, 3);
});

test("active SVG and HTML files are not accepted as game attachments", () => {
  assert.equal(typeof core.isSafeMediaType, "function");
  for (const type of ["image/svg+xml", "text/html", "application/javascript"]) assert.equal(core.isSafeMediaType(type), false);
  for (const type of ["image/jpeg", "image/png", "video/webm", "video/mp4", "application/pdf"]) assert.equal(core.isSafeMediaType(type), true);
});

test("failed metadata save restores the old attachment after replace or remove", async () => {
  assert.equal(typeof core.persistSlot, "function");
  for (const remove of [false, true]) {
    const store = new Map([["arcade-work-1", "original image"]]);
    const api = {
      getAsset: async key => store.get(key), saveAsset: async (key, value) => store.set(key, value),
      deleteAsset: async key => store.delete(key), saveContent: () => { throw new Error("quota"); }
    };
    await assert.rejects(core.persistSlot("work-1", {}, remove ? null : "new image", remove, api));
    assert.equal(store.get("arcade-work-1"), "original image");
  }
});

test("failed first attachment save leaves no orphan; text-only saves leave files untouched", async () => {
  assert.equal(typeof core.persistSlot, "function");
  const store = new Map();
  let metadata = null;
  const api = {
    getAsset: async key => store.get(key), saveAsset: async (key, value) => store.set(key, value), deleteAsset: async key => store.delete(key),
    saveContent: () => { throw new Error("quota"); }
  };
  await assert.rejects(core.persistSlot("work-1", {}, "new image", false, api));
  assert.equal(store.size, 0);
  store.set("arcade-work-1", "original image");
  api.saveContent = (id, value) => { metadata = { id, ...value }; };
  await core.persistSlot("work-1", { title: "A" }, null, false, api);
  assert.deepEqual(metadata, { id: "work-1", title: "A" });
  assert.equal(store.get("arcade-work-1"), "original image");
});

test("entering a cottage creates a walkable interior and exits to the same door", () => {
  assert.equal(typeof core.enterTownRoom, "function");
  const s = core.createTown();
  s.player.x = 5; s.player.y = 8;
  core.enterTownRoom(s, "workshop");
  assert.equal(s.room, "workshop");
  assert.ok(s.visited.includes("workshop"));
  s.player.x = 4; s.player.y = 5;
  assert.equal(core.interactTown(s).slots[0], "work-1");
  s.player.x = 7; s.player.y = 10;
  assert.equal(core.interactTown(s).type, "exit");
  core.leaveTownRoom(s);
  assert.equal(s.room, null);
  assert.deepEqual([s.player.x, s.player.y], [5, 8]);
});

test("cat and wishing well secrets unlock only after deliberate repeated interaction", () => {
  assert.equal(typeof core.discoverSecret, "function");
  const s = core.createTown();
  assert.equal(core.discoverSecret(s, "cat").unlocked, false);
  assert.equal(core.discoverSecret(s, "cat").unlocked, false);
  assert.equal(core.discoverSecret(s, "cat").unlocked, true);
  core.discoverSecret(s, "cat");
  assert.equal(s.secrets.filter(id => id === "cat").length, 1);
  for (let i = 0; i < 3; i++) assert.equal(core.discoverSecret(s, "well").unlocked, false);
  assert.equal(core.discoverSecret(s, "well").slots[0], "secret-well");
  assert.equal(core.discoverSecret(s, "bottle").slots[0], "secret-bottle");
});

test("walking interpolates visually while collisions remain on the tile grid", () => {
  const s = core.createTown();
  core.movePlayer(s, 1, 0);
  assert.equal(s.player.x, 16);
  assert.equal(s.player.drawX, 15);
  core.tickTown(s, 0.05);
  assert.ok(s.player.drawX > 15 && s.player.drawX < 16);
  core.tickTown(s, 1);
  assert.equal(s.player.drawX, 16);
});

test("outdoor guardians cannot hurt the player inside a cottage", () => {
  assert.equal(typeof core.enterTownRoom, "function");
  const s = core.createTown();
  core.enterTownRoom(s, "workshop");
  s.player.x = 6; s.player.y = 14;
  core.tickTown(s, 2);
  assert.equal(s.player.hp, 4);
});
