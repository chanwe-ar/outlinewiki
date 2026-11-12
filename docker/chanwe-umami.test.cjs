"use strict";

const assert = require("node:assert/strict");
const { test } = require("node:test");
const { identify, identifyWhenReady, start } = require("./chanwe/static/chanwe-umami.js");

const tracker = () => { const ids = []; return { ids, umami: { identify: (id) => ids.push(id) } }; };
const wiki = { hostname: "wiki.chanwe.ar" };

test("names the session with the Identity subject on the Wiki's host", () => {
  const { ids, umami } = tracker();
  assert.equal(identify("usr_a", { location: wiki, umami }), true);
  assert.deepEqual(ids, ["usr_a"]);
});

test("never inside the desktop app, on other hosts, without a subject or before the tracker loads", () => {
  const { ids, umami } = tracker();
  assert.equal(identify("usr_a", { location: wiki, umami, __CHANWE_DESKTOP__: {} }), false);
  assert.equal(identify("usr_a", { location: { hostname: "localhost" }, umami }), false);
  assert.equal(identify("", { location: wiki, umami }), false);
  assert.equal(identify("usr_a", { location: wiki }), false);
  assert.deepEqual(ids, []);
});

test("waits for Outline to load the tracker", async () => {
  const { ids, umami } = tracker();
  const win = { location: wiki };
  let waits = 0;
  assert.equal(await identifyWhenReady("usr_a", win, async () => { waits++; if (waits === 3) win.umami = umami; }), true);
  assert.deepEqual(ids, ["usr_a"]);
});

test("start asks the Wiki for the subject once and identifies with it", async () => {
  const { ids, umami } = tracker();
  const asked = [];
  const win = { location: wiki, umami, fetch: async (url, init) => { asked.push([url, init.credentials]); return { ok: true, json: async () => ({ subject: "usr_a" }) }; } };
  assert.equal(await start(win), true);
  assert.deepEqual(asked, [["/auth/chanwe.subject", "same-origin"]]);
  assert.deepEqual(ids, ["usr_a"]);
});

test("start does nothing inside the desktop app, off the Wiki's host, or without a subject", async () => {
  let asked = 0;
  const fetch = async () => { asked++; return { ok: false, json: async () => ({ subject: null }) }; };
  assert.equal(await start({ location: wiki, __CHANWE_DESKTOP__: {}, fetch }), false);
  assert.equal(await start({ location: { hostname: "localhost" }, fetch }), false);
  assert.equal(asked, 0);
  assert.equal(await start({ location: wiki, fetch }, async () => {}), false);
  assert.equal(asked, 1);
});
