"use strict";
// The menu script against Outline 1.12's real menu shape (Radix: role="menu" with aria-labelledby → its trigger;
// each item a role="menuitem" holding a MenuLabel <div> and a MenuShortcut <span> with the file-extension hint).
// Needs jsdom on NODE_PATH (like jsonwebtoken for the other tests).

const assert = require("node:assert/strict");
const { test } = require("node:test");
const { JSDOM } = require("jsdom");
const { decorate } = require("./chanwe/static/chanwe-export.js");

function wiki(path, triggerPlace) {
  const dom = new JSDOM(
    `<!doctype html><body>
      <nav id="sidebar"><button id="side-trigger">…</button></nav>
      <header><button id="head-trigger">…</button></header>
      <div role="menu" aria-labelledby="${triggerPlace === "sidebar" ? "side-trigger" : "head-trigger"}">
        <div role="menuitem" id="sub-trigger"><div>Exportar</div></div>
      </div>
      <div role="menu" aria-labelledby="sub-trigger">
        <div role="menuitem"><div>Markdown</div><span>.md</span></div>
        <div role="menuitem"><div>HTML</div><span>.html</span></div>
      </div>
    </body>`,
    { url: `https://wiki.chanwe.ar${path}` },
  );
  return dom.window;
}

test("adds the memo PDF after Outline's HTML item, looking like it", () => {
  const win = wiki("/doc/plan-q4-AbC123xyzQ", "header");
  decorate(win);
  const items = [...win.document.querySelectorAll('[aria-labelledby="sub-trigger"] [role="menuitem"]')];
  assert.equal(items.length, 3);
  const added = items[2];
  assert.equal(added.querySelector("div").textContent, "PDF (memo CHANWE)");
  assert.equal(added.querySelector("span").textContent, ".pdf");
});

test("adds nothing to a menu opened from the sidebar, which may be another page's", () => {
  const win = wiki("/doc/plan-q4-AbC123xyzQ", "sidebar");
  decorate(win);
  assert.equal(win.document.querySelectorAll('[aria-labelledby="sub-trigger"] [role="menuitem"]').length, 2);
});

test("adds it only once however often the page changes", () => {
  const win = wiki("/doc/plan-q4-AbC123xyzQ", "header");
  decorate(win);
  decorate(win);
  assert.equal(win.document.querySelectorAll("[data-chanwe-export]").length, 1);
});
