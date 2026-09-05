import test from "node:test";
import assert from "node:assert/strict";
import * as assets from "./arcade-art.js";

test("sprite backdrop removal preserves enclosed pale details and does not alter RGB", () => {
  assert.equal(typeof assets.matteSprite, "function");
  const data = new Uint8ClampedArray(5 * 5 * 4);
  for (let i = 0; i < 25; i++) data.set([244, 244, 244, 255], i * 4);
  for (const i of [6, 7, 8, 11, 13, 16, 17, 18]) data.set([91, 65, 32, 255], i * 4);
  assets.matteSprite(data, 5, 5);
  assert.equal(data[3], 0);
  assert.equal(data[6 * 4 + 3], 255);
  assert.equal(data[12 * 4 + 3], 255);
  assert.deepEqual([...data.slice(0, 3)], [244, 244, 244]);
});

test("Retina backing dimensions preserve logical camera area and cap memory", () => {
  assert.equal(typeof assets.canvasMetrics, "function");
  assert.deepEqual(assets.canvasMetrics(667, 234, 3), { width: 1334, height: 468, scale: 2 });
  assert.deepEqual(assets.canvasMetrics(1000, 500, 1), { width: 1000, height: 500, scale: 1 });
});

test("prop cutout mode clears enclosed white gaps without removing warm paper", () => {
  const data = new Uint8ClampedArray(5 * 5 * 4);
  for (let i = 0; i < 25; i++) data.set([92, 65, 32, 255], i * 4);
  data.set([252, 252, 252, 255], 12 * 4);
  data.set([245, 233, 207, 255], 13 * 4);
  assets.matteSprite(data, 5, 5, true);
  assert.equal(data[12 * 4 + 3], 0);
  assert.equal(data[13 * 4 + 3], 255);
});
