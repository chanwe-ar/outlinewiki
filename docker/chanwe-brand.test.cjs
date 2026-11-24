"use strict";

// D-0060 (chanwe-brandbook): the wiki keeps no look of its own. Its stylesheet and tokens are copies the brandbook's
// brand:sync writes, and Outline's theme takes every value from the tokens.json copy.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

const here = (...p) => path.join(__dirname, ...p);

test("the only stylesheets are the brandbook's copies", () => {
  // All of docker/, CHANWE's layer: in the image's test run the folder is mounted without the rest of the repo.
  const css = fs.readdirSync(__dirname, { recursive: true }).filter((f) => /\.(css|scss|sass|less)$/i.test(f)).map((f) => f.split(path.sep).join("/")).sort();
  assert.deepEqual(css, ["chanwe/static/chanwe-outline.css", "chanwe/static/tokens.css"]);
  const first = (f) => fs.readFileSync(here(f), "utf8").split("\n", 1)[0];
  assert.equal(first("chanwe/static/chanwe-outline.css"), "/* Written in chanwe-brandbook (brand/ui/apps/wiki.css) and copied here by its brand:sync (D-0060). Never edit this copy. */");
  assert.equal(first("chanwe/static/tokens.css"), "/* Generated from brand/ui/tokens/tokens.json by scripts/brand-tokens.mjs. Do not edit; change tokens.json and run npm run brand:tokens. */");
});

test("Outline's theme takes its values from tokens.json, never a literal colour", () => {
  const src = fs.readFileSync(here("brand-outline.cjs"), "utf8");
  const theme = src.slice(src.indexOf("const THEME = ["), src.indexOf("];", src.indexOf("const THEME = [")));
  const brandSides = theme.split("\n").filter((l) => l.trim().startsWith("[") || l.trim().startsWith("`")).map((l) => l.split("\", ").pop());
  for (const side of brandSides) assert.doesNotMatch(side, /#[0-9a-f]{3,8}\b|rgba?\(\d|hsl\(/i, side);
  const tokens = JSON.parse(fs.readFileSync(here("chanwe/tokens.json"), "utf8"));
  assert.ok(tokens.color.palette.primary && tokens.color.dark["fg-muted"], "tokens.json is the brandbook's");
});
