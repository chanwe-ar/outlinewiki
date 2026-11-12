"use strict";

const assert = require("node:assert/strict");
const { test } = require("node:test");
const { identitySubject, subjectHandler } = require("./chanwe-subject.cjs");

const user = { id: "u-1", teamId: "t-1" };

/** Models whose UserAuthentication.findAll answers with `rows` and records the query. */
function models(rows) {
  const calls = [];
  return {
    calls,
    AuthenticationProvider: { name: "AuthenticationProvider" },
    UserAuthentication: { findAll: async (query) => { calls.push(query); return rows; } },
  };
}

function ctx(token) {
  const headers = {};
  return {
    headers,
    cookies: { get: (name) => (name === "accessToken" ? token : undefined) },
    set: (name, value) => { headers[name] = value; },
  };
}

test("the subject is the providerId of the user's Identity (oidc) authentication in their team", async () => {
  const m = models([{ providerId: "usr_chanwe_owner_alejandro_abraham" }]);
  assert.equal(await identitySubject(user, m), "usr_chanwe_owner_alejandro_abraham");
  assert.deepEqual(m.calls[0].where, { userId: "u-1" });
  assert.deepEqual(m.calls[0].include[0].where, { name: "oidc", teamId: "t-1" });
  assert.equal(m.calls[0].include[0].required, true);
});

test("no subject when there is none, several, or one Umami could not keep", async () => {
  assert.equal(await identitySubject(user, models([])), null);
  assert.equal(await identitySubject(user, models([{ providerId: "usr_a" }, { providerId: "usr_b" }])), null);
  assert.equal(await identitySubject(user, models([{ providerId: "ana@chanwe.com.ar" }])), null);
  assert.equal(await identitySubject(user, models([{ providerId: `usr_${"a".repeat(60)}` }])), null);
  assert.equal(await identitySubject(null, models([{ providerId: "usr_a" }])), null);
});

test("GET /auth/chanwe.subject answers the signed-in person's subject, never cached", async () => {
  const m = models([{ providerId: "usr_a" }]);
  const handler = subjectHandler({ models: m, getUserForJWT: async (token, kinds) => { assert.equal(token, "jwt"); assert.deepEqual(kinds, ["session"]); return { user }; } });
  const c = ctx("jwt");
  await handler(c);
  assert.deepEqual(c.body, { subject: "usr_a" });
  assert.equal(c.headers["Cache-Control"], "no-store");
});

test("without a valid session it is a 401 with no subject", async () => {
  const handler = subjectHandler({ models: models([{ providerId: "usr_a" }]), getUserForJWT: async () => { throw new Error("expired"); } });
  for (const token of [undefined, "bad"]) {
    const c = ctx(token);
    await handler(c);
    assert.equal(c.status, 401);
    assert.deepEqual(c.body, { subject: null });
  }
});
