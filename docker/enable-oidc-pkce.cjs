"use strict";

const fs = require("node:fs");
const path = require("node:path");

// The runtime image copies compiled code from outline-base, not this repository.
// Fail the image build if that code changes rather than silently omit PKCE.
const target = path.resolve("build/plugins/oidc/server/auth/oidc.js");
let source = fs.readFileSync(target, "utf8");
const replacements = [
  [
    "new _passport2.StateStore()",
    'new (require("../../../../../docker/oidc-pkce-store.cjs").OIDCPKCEStore)(new _passport2.StateStore())',
  ],
  ["pkce: false", 'pkce: "S256"'],
  [
    'const profile = await (0, _passport2.request)(usePostMethod.includes(_env.default.OIDC_USERINFO_URI) ? "POST" : "GET", _env.default.OIDC_USERINFO_URI, accessToken);',
    'const profile = await require("../../../../../docker/oidc-identity-profile.cjs").identityProfile(params.id_token, accessToken);',
  ],
];
for (const [before, after] of replacements) {
  if (source.split(before).length !== 2) {
    throw new Error(`Unexpected compiled OIDC implementation: ${before}`);
  }
  source = source.replace(before, after);
}
fs.writeFileSync(target, source);
