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
