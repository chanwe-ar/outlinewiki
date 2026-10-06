"use strict";

/**
 * Applies the CHANWE brand to the released Outline frontend at image build
 * time. The runtime image ships Outline's compiled bundle, not this repo's
 * source, so the brand is applied to build/app the same way the OIDC adapter
 * is applied to the server (see configure-outline-release.cjs): every edit is
 * an exact match that fails the build if Outline changes underneath it.
 *
 * 1. Outline's theme chunk gets the brand colours and fonts (brandbook
 *    tokens.json): orange accent and links, slate neutrals, Satoshi body,
 *    JetBrains Mono code.
 * 2. Hashed assets are served `immutable` for a year and cached by Outline's
 *    service worker for 30 days, so an edited chunk under its old URL would
 *    never reach returning browsers. The assets directory therefore moves to
 *    a name derived from the patched theme, and every reference to it is
 *    rewritten; `assets` stays as a symlink so tabs opened before a deploy can
 *    still lazy-load their chunks.
 * 3. docker/chanwe/static (fonts, stylesheet, sidebar script, app veil, icons)
 *    is published under a content-hashed /static/chanwe-<hash>/ and wired into
 *    index.html.
 */

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const APP = path.resolve("build/app");
const STATIC_SOURCE = path.resolve("docker/chanwe/static");

const version = JSON.parse(fs.readFileSync("package.json", "utf8")).version;
if (version !== "1.10.1") {
  throw new Error(`Expected Outline 1.10.1, received ${version}`);
}

const replaceOnce = (source, before, after, label) => {
  if (source.split(before).length !== 2) {
    throw new Error(`Unexpected Outline ${version} ${label}: ${before}`);
  }
  return source.replace(before, () => after);
};

const shortHash = (...parts) => {
  const hash = crypto.createHash("sha256");
  parts.forEach((part) => hash.update(part));
  return hash.digest("hex").slice(0, 10);
};

// 1. Theme. Values are brand/tokens/tokens.json roles.
const THEME = [
  ["accent:`#0366d6`", "accent:`#FD3810`"], // primary
  [
    "fontFamily:`-apple-system, BlinkMacSystemFont, Inter, 'Segoe UI', Roboto, Oxygen, sans-serif`",
    "fontFamily:`Satoshi, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, sans-serif`",
  ],
  [
    "fontFamilyMono:`'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, Courier, monospace`",
    "fontFamilyMono:`'JetBrains Mono', 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, Courier, monospace`",
  ],
  ["slate:`#66778F`", "slate:`#64748B`"], // ink-fg
  ["slateLight:`#DAE1E9`", "slateLight:`#E2E8F0`"], // rule
  ["slateDark:`#394351`", "slateDark:`#475569`"], // body-fg
  ["smoke:`#F4F7FA`", "smoke:`#F1F5F9`"], // surface-sunken
  ["smokeLight:`#F9FBFC`", "smokeLight:`#F8FAFC`"], // paper
  ["warmGrey:`hsl(212 31% 95% / 1)`", "warmGrey:`#F1F5F9`"], // surface-sunken
  // The light theme's sidebar is the brand app shell's dark rail (ink-light),
  // white at 65%, the active item in orange (chanwe-brandbook app-shell.css).
  ["sidebarBackground:`hsl(212 31% 95% / 1)`", "sidebarBackground:`#232A35`"],
  ["sidebarHoverBackground:`hsl(212 31% 90% / 1)`", "sidebarHoverBackground:`rgba(255, 255, 255, 0.1)`"],
  ["sidebarActiveBackground:`hsl(212 31% 85% / 1)`", "sidebarActiveBackground:`#FD3810`"],
  ["sidebarControlHoverBackground:`rgb(138 164 193 / 20%)`", "sidebarControlHoverBackground:`rgba(255, 255, 255, 0.12)`"],
  ["sidebarDraftBorder:`hsl(212 31% 75% / 1)`", "sidebarDraftBorder:`rgba(255, 255, 255, 0.25)`"],
  ["sidebarText:`rgb(78, 92, 110)`", "sidebarText:`rgba(255, 255, 255, 0.65)`"],
  ["link:`#137FFB`", "link:`#FD3810`"], // dark theme links
  // Light code highlighting in the brand code roles.
  ["codeKeyword:`#00009f`", "codeKeyword:`#FD3810`"],
  ["codeString:`#a31515`", "codeString:`#15803D`"],
  ["codeNumber:`#0550ae`", "codeNumber:`#7C3AED`"],
  ["codeComment:`#008000`", "codeComment:`#928D86`"],
  ["codeFunction:`#393A34`", "codeFunction:`#475569`"],
];

const assetsDir = path.join(APP, "assets");
const themeFiles = fs
  .readdirSync(assetsDir)
  .filter((name) => name.endsWith(".js"))
  .filter((name) =>
    fs.readFileSync(path.join(assetsDir, name), "utf8").includes(THEME[0][0])
  );
if (themeFiles.length !== 1) {
  throw new Error(`Expected one Outline theme chunk, found ${themeFiles.length}`);
}
const themePath = path.join(assetsDir, themeFiles[0]);
let theme = fs.readFileSync(themePath, "utf8");
for (const [before, after] of THEME) {
  theme = replaceOnce(theme, before, after, "theme");
}
fs.writeFileSync(themePath, theme);

// No "Log out": sessions belong to CHANWE Identity and end from Espacios, like
// every CHANWE app. Outline hides an action whose `visible` returns false, in
// the account menu and the command bar alike.
const LOGOUT_ACTION = "analyticsName:`Log out`,";
const navigationFiles = fs
  .readdirSync(assetsDir)
  .filter((name) => name.endsWith(".js"))
  .filter((name) =>
    fs.readFileSync(path.join(assetsDir, name), "utf8").includes(LOGOUT_ACTION)
  );
if (navigationFiles.length !== 1) {
  throw new Error(`Expected one Outline logout action, found ${navigationFiles.length}`);
}
const navigationPath = path.join(assetsDir, navigationFiles[0]);
const navigation = replaceOnce(
  fs.readFileSync(navigationPath, "utf8"),
  LOGOUT_ACTION,
  `${LOGOUT_ACTION}visible:()=>!1,`,
  "logout action"
);
fs.writeFileSync(navigationPath, navigation);

// 2. Move the assets so every browser fetches the patched bundle. The name
// covers every patched chunk, so a change to any of them gets a new URL.
const assetsName = `assets-cw${shortHash(theme, navigation)}`;
const files = new Set(fs.readdirSync(assetsDir));
// Only rewrite references to files that exist, so prose or URLs that merely
// contain "assets/" are left alone.
const rewrite = (source) =>
  source.replace(/\bassets\/([A-Za-z0-9_.-]+)/g, (match, name) =>
    files.has(name) ? `${assetsName}/${name}` : match
  );

for (const name of files) {
  if (/\.(js|css)$/.test(name)) {
    const file = path.join(assetsDir, name);
    fs.writeFileSync(file, rewrite(fs.readFileSync(file, "utf8")));
  }
}
for (const name of [".vite/manifest.json", "webpack-stats.json"]) {
  const file = path.join(APP, name);
  fs.writeFileSync(file, rewrite(fs.readFileSync(file, "utf8")));
}
const swPath = path.join(APP, "sw.js");
let sw = rewrite(fs.readFileSync(swPath, "utf8"));
sw = replaceOnce(
  sw,
  'e.pathname.startsWith("/static/assets/")',
  `e.pathname.startsWith("/static/${assetsName}/")`,
  "service worker"
);
fs.writeFileSync(swPath, sw);
// Copy rather than rename: overlayfs cannot rename a directory that comes
// from a lower image layer (EXDEV).
fs.cpSync(assetsDir, path.join(APP, assetsName), { recursive: true });
fs.rmSync(assetsDir, { recursive: true, force: true });
fs.symlinkSync(assetsName, assetsDir);

// 3. Brand files under a content-hashed directory.
const staticFiles = [];
const walk = (dir) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(file);
    } else {
      staticFiles.push(file);
    }
  }
};
walk(STATIC_SOURCE);
staticFiles.sort();
const brandName = `chanwe-${shortHash(
  ...staticFiles.flatMap((file) => [
    path.relative(STATIC_SOURCE, file),
    fs.readFileSync(file),
  ])
)}`;
fs.cpSync(STATIC_SOURCE, path.join(APP, brandName), { recursive: true });

const brand = `{cdn-url}/static/${brandName}`;
const indexPath = path.join(APP, "index.html");
let index = fs.readFileSync(indexPath, "utf8");
index = replaceOnce(
  index,
  "{head-tags}",
  `{head-tags}
    <link rel="icon" type="image/svg+xml" href="${brand}/wiki.svg" />
    <link rel="preload" href="${brand}/fonts/Satoshi-Regular.woff2" as="font" type="font/woff2" crossorigin />
    <link rel="stylesheet" href="${brand}/tokens.css" />
    <link rel="stylesheet" href="${brand}/chanwe-outline.css" />
    <script defer src="${brand}/chanwe-outline.js"></script>`,
  "index.html head"
);
// The veil must be a blocking script ahead of the app so it covers the first
// paint; chanwe-outline.js lifts it once Outline has rendered (data-wait).
index = replaceOnce(
  index,
  '<div id="root"></div>',
  `<script src="${brand}/app-veil.js" data-icon="${brand}/wiki.svg" data-label="Wiki" data-wait></script>
    <div id="root"></div>`,
  "index.html body"
);
fs.writeFileSync(indexPath, index);

// Outline's React app re-adds `<link rel="shortcut icon">` with the server's
// default on every page, and browsers use the last icon link. That default is
// /images/favicon-32.png, cached for 7 days, so browsers kept Outline's own
// icon after it was replaced. Point it at the hashed copy instead.
const appRoutePath = path.resolve("build/server/routes/app.js");
fs.writeFileSync(
  appRoutePath,
  replaceOnce(
    fs.readFileSync(appRoutePath, "utf8"),
    'shortcutIcon = `${_env.default.CDN_URL || ""}/images/favicon-32.png`',
    `shortcutIcon = \`\${_env.default.CDN_URL || ""}/static/${brandName}/favicon-32.png\``,
    "default favicon"
  )
);

const manifestPath = path.join(APP, "manifest.webmanifest");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
Object.assign(manifest, {
  name: "Wiki CHANWE",
  short_name: "Wiki",
  background_color: "#F8FAFC",
  theme_color: "#F8FAFC",
  lang: "es",
});
fs.writeFileSync(manifestPath, JSON.stringify(manifest));

console.log(`CHANWE brand applied: ${assetsName}, ${brandName}`);
