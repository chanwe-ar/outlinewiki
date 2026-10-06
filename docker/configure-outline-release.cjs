"use strict";

const fs = require("node:fs");
const path = require("node:path");

const version = JSON.parse(fs.readFileSync("package.json", "utf8")).version;
if (version !== "1.10.1") {
  throw new Error(`Expected Outline 1.10.1, received ${version}`);
}

// Assert exact matches so an upstream change cannot silently bypass the adapter.
const target = path.resolve("build/plugins/oidc/server/auth/oidcRouter.js");
let source = fs.readFileSync(target, "utf8");
const replacements = [
  [
    "new _passport1.StateStore(endpoints.pkce)",
    "new _passport1.StateStore(true)",
  ],
  ["pkce: endpoints.pkce ?? false", 'pkce: "S256"'],
  [
    'const profile = await (0, _passport1.request)(usePostMethod.includes(endpoints.userInfoURL) ? "POST" : "GET", endpoints.userInfoURL, accessToken);',
    'const profile = await require("../../../../../docker/oidc-identity-profile.cjs").identityProfile(params.id_token, accessToken);',
  ],
];
for (const [before, after] of replacements) {
  if (source.split(before).length !== 2) {
    throw new Error(`Unexpected Outline 1.10.1 OIDC implementation: ${before}`);
  }
  source = source.replace(before, after);
}
fs.writeFileSync(target, source);

// Signing out of Espacios signs out of every CHANWE app: Espacios calls each
// app's local sign-out after CHANWE Identity has ended its session. Outline's
// own sign-out is a CSRF-protected API call, so this adds a plain GET that
// only clears this browser's session cookie (no Identity round trip).
const authRouter = path.resolve("build/server/routes/auth/index.js");
const signoutAnchor = 'router.get("/redirect", ';
let authSource = fs.readFileSync(authRouter, "utf8");
if (authSource.split(signoutAnchor).length !== 2) {
  throw new Error(`Unexpected Outline 1.10.1 auth router: ${signoutAnchor}`);
}
authSource = authSource.replace(
  signoutAnchor,
  `router.get("/chanwe.signout", (ctx) => {
    ctx.cookies.set("accessToken", "", { sameSite: "lax", expires: new Date(0) });
    ctx.set("Cache-Control", "no-store");
    ctx.status = 204;
});
${signoutAnchor}`
);
fs.writeFileSync(authRouter, authSource);
