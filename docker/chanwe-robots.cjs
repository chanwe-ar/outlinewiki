"use strict";

// CHANWE robots policy (2026-11-15, chanwe-main/robots.txt and terms section 4): open to people and search, closed
// to AI training and to SEO and competitive-intelligence scrapers. The image is Outline's release, so the policy is
// patched into the built robots.txt route. Exact matches: the build fails if Outline changes the file.
const fs = require("node:fs");
const path = require("node:path");

const target = path.resolve("build/server/routes/discovery/robots.js");
let source = fs.readFileSync(target, "utf8");

const blocked = [
  // AI training and dataset crawlers.
  "GPTBot", "ClaudeBot", "anthropic-ai", "CCBot", "Google-Extended", "Applebot-Extended", "Bytespider",
  "meta-externalagent", "FacebookBot", "Amazonbot", "cohere-ai", "cohere-training-data-crawler", "Diffbot",
  "AI2Bot", "Ai2Bot-Dolma", "img2dataset", "Omgilibot", "Timpibot", "ImagesiftBot", "PetalBot", "webzio-extended",
  // SEO and competitive-intelligence scrapers.
  "AhrefsBot", "SemrushBot", "MJ12bot", "DotBot", "DataForSeoBot", "BLEXBot", "serpstatbot",
];

const replacements = [
  [
    "const robotsResponse = ()=>`\nUser-agent: *\n",
    "const robotsResponse = ()=>`\n# CHANWE Wiki: no bulk harvesting or AI training. Terms: https://chanwe.ar/es/terminos (section 4)\nUser-agent: *\nContent-Signal: search=yes, ai-input=yes, ai-train=no\n",
  ],
  [
    "Disallow: /desktop-redirect\n`;",
    `Disallow: /desktop-redirect\n\n${blocked.map((bot) => `User-agent: ${bot}`).join("\n")}\nDisallow: /\n\`;`,
  ],
];
for (const [before, after] of replacements) {
  if (source.split(before).length !== 2) {
    throw new Error(`Unexpected Outline 1.12.0 robots route: ${JSON.stringify(before)}`);
  }
  source = source.replace(before, after);
}
fs.writeFileSync(target, source);
