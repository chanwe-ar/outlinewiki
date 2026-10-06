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
// own sign-out is a CSRF-protected API call, so this adds a plain GET that does
// what auth.delete does (no Identity round trip): it rotates the user's JWT
// secret, so a copied session token stops working too, and clears the cookies.
const authRouter = path.resolve("build/server/routes/auth/index.js");
const signoutAnchor = 'router.get("/redirect", ';
let authSource = fs.readFileSync(authRouter, "utf8");
if (authSource.split(signoutAnchor).length !== 2) {
  throw new Error(`Unexpected Outline 1.10.1 auth router: ${signoutAnchor}`);
}
authSource = authSource.replace(
  signoutAnchor,
  `router.get("/chanwe.signout", async (ctx) => {
    const token = ctx.cookies.get("accessToken");
    if (token) {
        try {
            const { user } = await require("../../utils/jwt").getUserForJWT(token, ["session"]);
            await user.rotateJwtSecret({});
        } catch {
            // An expired or unknown token has no session left to revoke.
        }
    }
    ctx.cookies.set("accessToken", "", { sameSite: "lax", expires: new Date(0) });
    ctx.cookies.set("sessions", "", { expires: new Date(0) });
    ctx.set("Cache-Control", "no-store");
    ctx.status = 204;
});
${signoutAnchor}`
);
fs.writeFileSync(authRouter, authSource);

// Sessions last at most 7 days, like every CHANWE app (Outline's default is 3
// months). The same date sets the cookie and the session token's expiry.
const authentication = path.resolve("build/server/utils/authentication.js");
let authenticationSource = fs.readFileSync(authentication, "utf8");
const sessionLength = /\(0,\s*[\w$]+\.addMonths\)\(new Date\(\),\s*3\)/g;
const sessionLengthMatches = authenticationSource.match(sessionLength) || [];
if (sessionLengthMatches.length !== 1) {
  throw new Error(`Unexpected Outline 1.10.1 session length: ${sessionLengthMatches.length} matches`);
}
authenticationSource = authenticationSource.replace(
  sessionLength,
  "new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)"
);
fs.writeFileSync(authentication, authenticationSource);
