"use strict";

const assert = require("node:assert/strict");
const { test } = require("node:test");
const { routeTarget, exportItems, findAnchor, start } = require("./chanwe/static/chanwe-export.js");

test("reads the page or collection from the Wiki's routes", () => {
  assert.deepEqual(routeTarget("/doc/plan-q4-AbC123xyzQ"), { kind: "document", id: "AbC123xyzQ" });
  assert.deepEqual(routeTarget("/doc/AbC123xyzQ/edit"), { kind: "document", id: "AbC123xyzQ" });
  assert.deepEqual(routeTarget("/collection/interno-XyZ123abcD"), { kind: "collection", id: "XyZ123abcD" });
  assert.deepEqual(routeTarget("/collection/interno-XyZ123abcD/recent"), { kind: "collection", id: "XyZ123abcD" });
  assert.equal(routeTarget("/settings"), null);
  assert.equal(routeTarget("/s/share-id"), null);
});

test("offers the memo PDF on a page and both files on a collection", () => {
  assert.deepEqual(exportItems({ kind: "document", id: "AbC123xyzQ" }), [
    { label: "PDF (memo CHANWE)", href: "/chanwe/export/document/AbC123xyzQ.pdf" },
  ]);
  assert.deepEqual(exportItems({ kind: "collection", id: "XyZ123abcD" }), [
    { label: "Markdown (un archivo)", href: "/chanwe/export/collection/XyZ123abcD.md" },
    { label: "PDF (memo CHANWE)", href: "/chanwe/export/collection/XyZ123abcD.pdf" },
  ]);
});

test("anchors on Outline's download submenu for a page, in Spanish or English", () => {
  assert.equal(findAnchor(["Markdown", "HTML"], { kind: "document" }), 1);
  assert.equal(findAnchor(["HTML", "Markdown"], { kind: "document" }), 1);
  assert.equal(findAnchor(["Editar", "Markdown"], { kind: "document" }), -1);
});

test("anchors on Outline's export item for a collection", () => {
  assert.equal(findAnchor(["Nuevo documento", "Exportar…", "Eliminar…"], { kind: "collection" }), 1);
  assert.equal(findAnchor(["New document", "Export…"], { kind: "collection" }), 1);
  assert.equal(findAnchor(["Nuevo documento"], { kind: "collection" }), -1);
});

test("adds nothing when no menu is open", () => {
  const observed = [];
  const win = {
    location: { pathname: "/doc/plan-AbC123xyzQ" },
    MutationObserver: function (callback) {
      this.observe = () => observed.push(callback);
    },
    document: { body: {}, querySelectorAll: () => [] },
  };
  start(win);
  assert.equal(observed.length, 1);
  observed[0]();
});
