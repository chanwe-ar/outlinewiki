"use strict";

const assert = require("node:assert/strict");
const { test } = require("node:test");
const crypto = require("node:crypto");
const jwt = require("jsonwebtoken");
const { verifyIdentityProfile } = require("./oidc-identity-profile.cjs");

const { privateKey, publicKey } = crypto.generateKeyPairSync("rsa", {
  modulusLength: 2048,
});
const configuration = {
  issuer: "https://identity.example.com",
  audience: "wiki-client",
  keys: [
    {
      ...publicKey.export({ format: "jwk" }),
      kid: "test-key",
      use: "sig",
      alg: "RS256",
    },
  ],
};
const claims = {
  sub: "test-user",
  name: "Test User",
  email: "test@example.com",
  email_verified: true,
  iss: configuration.issuer,
  aud: configuration.audience,
  exp: Math.floor(Date.now() / 1000) + 300,
};
const sign = (changes = {}) =>
  jwt.sign({ ...claims, ...changes }, privateKey, {
    algorithm: "RS256",
    keyid: "test-key",
  });

test("accepts a signed profile for the configured issuer and wiki client", () => {
  assert.equal(
    verifyIdentityProfile(sign(), "access-token", configuration).email,
    claims.email
  );
});

for (const [name, changes] of Object.entries({
  issuer: { iss: "https://attacker.example.com" },
  audience: { aud: "other-client" },
  expiry: { exp: 1 },
  email: { email: "" },
  verification: { email_verified: false },
  subject: { sub: "" },
  party: { azp: "other-client" },
  multipleAudiences: { aud: [configuration.audience, "other"] },
  futureIssuedAt: { iat: Math.floor(Date.now() / 1000) + 3600 },
})) {
  test(`rejects invalid ${name}`, () => {
    assert.throws(() =>
      verifyIdentityProfile(sign(changes), "access-token", configuration)
    );
  });
}

test("rejects a forged signature", () => {
  const other = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
  const token = jwt.sign(claims, other.privateKey, {
    algorithm: "RS256",
    keyid: "test-key",
  });
  assert.throws(() =>
    verifyIdentityProfile(token, "access-token", configuration)
  );
});

test("rejects unsigned tokens and missing expiry", () => {
  const token = jwt.sign(claims, null, { algorithm: "none" });
  assert.throws(() =>
    verifyIdentityProfile(token, "access-token", configuration)
  );
  const { exp, ...withoutExpiry } = claims;
  const noExpiry = jwt.sign(withoutExpiry, privateKey, {
    algorithm: "RS256",
    keyid: "test-key",
  });
  assert.throws(() =>
    verifyIdentityProfile(noExpiry, "access-token", configuration)
  );
});

test("checks the access-token hash when present", () => {
  const at_hash = crypto
    .createHash("sha256")
    .update("access-token")
    .digest()
    .subarray(0, 16)
    .toString("base64url");
  assert.equal(
    verifyIdentityProfile(sign({ at_hash }), "access-token", configuration).sub,
    claims.sub
  );
  assert.throws(() =>
    verifyIdentityProfile(sign({ at_hash }), "different-token", configuration)
  );
});

const wikiConfiguration = {
  ...configuration,
  resourceAudience: "wiki-api",
  requiredScope: "wiki:access",
};
const grant = {
  sub: claims.sub,
  iss: configuration.issuer,
  aud: wikiConfiguration.resourceAudience,
  client_id: configuration.audience,
  scope: "wiki:access",
  exp: Math.floor(Date.now() / 1000) + 300,
};
const signGrant = (changes = {}, key = privateKey) =>
  jwt.sign({ ...grant, ...changes }, key, {
    algorithm: "RS256",
    keyid: "test-key",
  });

test("accepts an access token that grants the Wiki to the same person", () => {
  assert.equal(
    verifyIdentityProfile(sign(), signGrant(), wikiConfiguration).sub,
    claims.sub
  );
});

for (const [name, changes] of Object.entries({
  scope: { scope: "apps:catalog:read" },
  emptyScope: { scope: "" },
  subject: { sub: "someone-else" },
  audience: { aud: "other-api" },
  issuer: { iss: "https://attacker.example.com" },
  client: { client_id: "other-client" },
  expiry: { exp: 1 },
})) {
  test(`rejects an access token with a wrong ${name}`, () => {
    assert.throws(() =>
      verifyIdentityProfile(sign(), signGrant(changes), wikiConfiguration)
    );
  });
}

test("rejects a forged or opaque access token", () => {
  const other = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
  assert.throws(() =>
    verifyIdentityProfile(
      sign(),
      signGrant({}, other.privateKey),
      wikiConfiguration
    )
  );
  assert.throws(() =>
    verifyIdentityProfile(sign(), "access-token", wikiConfiguration)
  );
});
