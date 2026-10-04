"use strict";

const assert = require("node:assert/strict");
const { test } = require("node:test");
const { OIDCPKCEStore } = require("./oidc-pkce-store.cjs");

const verifier = "a".repeat(43);

function fixture() {
  const cookies = new Map();
  const ctx = {
    cookies: {
      get: (key) => cookies.get(key),
      set: (key, value, options) => {
        assert.equal(options.secure, true);
        assert.equal(options.httpOnly, true);
        assert.equal(options.sameSite, "lax");
        assert.equal(options.path, "/");
        assert.equal(options.domain, undefined);
        cookies.set(key, value);
      },
    },
  };
  const legacy = {
    store: (ctx, callback) => callback(null, "nonce"),
    verify: (ctx, token, callback) =>
      callback(null, token === "nonce", "host|nonce|web"),
  };
  return { cookies, ctx, store: new OIDCPKCEStore(legacy, "test-secret") };
}

function save(f) {
  f.store.store(f.ctx, verifier, null, null, (error, token) => {
    assert.equal(error, null);
    assert.equal(token, "nonce");
  });
}

function assertRejected(f) {
  f.store.verify(f.ctx, "nonce", (error, valid) => {
    assert.ok(error);
    assert.equal(valid, false);
  });
}

test("returns the verifier and preserves state, then consumes the cookie", () => {
  const f = fixture();
  save(f);
  assert.equal(f.store.store.length, 5);
  assert.equal(f.store.verify.length, 3);
  assert.ok(![...f.cookies.values()][0].includes(verifier));
  f.store.verify(f.ctx, "nonce", (error, value, state) => {
    assert.equal(error, null);
    assert.equal(value, verifier);
    assert.equal(state, "host|nonce|web");
  });
  assertRejected(f);
});

test("preserves the legacy CSRF state check", () => {
  const f = fixture();
  save(f);
  f.store.verify(f.ctx, "wrong", (error, valid) => {
    assert.equal(valid, false);
  });
});

test("rejects tampered and missing cookies", () => {
  const f = fixture();
  assertRejected(f);
  save(f);
  for (const key of f.cookies.keys()) {
    f.cookies.set(key, "invalid");
  }
  assertRejected(f);
});

test("rejects cookies encrypted with another secret", () => {
  const f = fixture();
  save(f);
  f.store = new OIDCPKCEStore(f.store.legacyStore, "wrong-key");
  assertRejected(f);
});

test("rejects expired cookies", () => {
  const f = fixture();
  save(f);
  const now = Date.now;
  try {
    Date.now = () => now() + 700000;
    assertRejected(f);
  } finally {
    Date.now = now;
  }
});

test("requires an encryption secret and a verifier", () => {
  assert.throws(() => new OIDCPKCEStore({}, ""));
  const f = fixture();
  f.store.store(f.ctx, undefined, null, null, (error) => {
    assert.ok(error);
  });
});
