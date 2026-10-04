"use strict";

const crypto = require("node:crypto");
const jwt = require("jsonwebtoken");

let cachedDiscovery;

/**
 * Verifies an Identity ID token before using its standard profile claims.
 *
 * @param token the ID token returned by the code exchange.
 * @param accessToken the access token returned in the same exchange.
 * @param configuration the trusted issuer, audience, and public signing keys.
 * @returns the verified identity profile.
 */
function verifyIdentityProfile(token, accessToken, configuration) {
  const decoded = jwt.decode(token, { complete: true });
  if (!decoded || decoded.header.alg !== "RS256") {
    throw new Error("Identity returned an unsupported ID token");
  }
  const jwk = configuration.keys.find(
    (key) =>
      key.kid === decoded.header.kid &&
      key.kty === "RSA" &&
      (!key.use || key.use === "sig") &&
      (!key.alg || key.alg === "RS256")
  );
  if (!jwk) {
    throw new Error("Identity signing key was not found");
  }
  const profile = jwt.verify(
    token,
    crypto.createPublicKey({ key: jwk, format: "jwk" }),
    {
      algorithms: ["RS256"],
      issuer: configuration.issuer,
      audience: configuration.audience,
    }
  );
  if (
    typeof profile !== "object" ||
    !Number.isFinite(profile.exp) ||
    !Number.isFinite(profile.iat) ||
    profile.iat > Date.now() / 1000 + 60 ||
    typeof profile.sub !== "string" ||
    !profile.sub ||
    typeof profile.email !== "string" ||
    !profile.email ||
    profile.email_verified !== true ||
    (profile.azp && profile.azp !== configuration.audience) ||
    (Array.isArray(profile.aud) &&
      profile.aud.length > 1 &&
      profile.azp !== configuration.audience)
  ) {
    throw new Error("Identity returned incomplete or invalid profile claims");
  }
  if (profile.at_hash) {
    const hash = crypto
      .createHash("sha256")
      .update(accessToken)
      .digest()
      .subarray(0, 16)
      .toString("base64url");
    if (profile.at_hash !== hash) {
      throw new Error("Identity ID token does not match the access token");
    }
  }
  return profile;
}

/**
 * Fetches trusted public metadata and verifies the code exchange's ID token.
 * Resource access tokens target the wiki API and cannot call OIDC userinfo.
 *
 * @param token the ID token returned by the code exchange.
 * @param accessToken the access token returned by the code exchange.
 * @returns the verified identity profile.
 */
async function identityProfile(token, accessToken) {
  const issuer = process.env.OIDC_ISSUER_URL;
  const audience = process.env.OIDC_CLIENT_ID;
  if (!issuer || !audience || new URL(issuer).protocol !== "https:") {
    throw new Error("An HTTPS OIDC issuer and client ID are required");
  }
  const header = jwt.decode(token, { complete: true })?.header;
  if (
    !cachedDiscovery ||
    cachedDiscovery.issuer !== issuer ||
    cachedDiscovery.expires < Date.now() ||
    !cachedDiscovery.keys.some((key) => key.kid === header?.kid)
  ) {
    const response = await fetch(
      `${issuer.replace(/\/$/, "")}/.well-known/openid-configuration`,
      {
        signal: AbortSignal.timeout(10000),
        redirect: "error",
      }
    );
    if (!response.ok) {
      throw new Error("Unable to load Identity discovery metadata");
    }
    const metadata = await response.json();
    if (
      metadata.issuer !== issuer ||
      new URL(metadata.jwks_uri).origin !== new URL(issuer).origin
    ) {
      throw new Error("Identity discovery metadata does not match the issuer");
    }
    const keysResponse = await fetch(metadata.jwks_uri, {
      signal: AbortSignal.timeout(10000),
      redirect: "error",
    });
    if (!keysResponse.ok) {
      throw new Error("Unable to load Identity public signing keys");
    }
    const { keys } = await keysResponse.json();
    if (!Array.isArray(keys)) {
      throw new Error("Invalid Identity public signing keys");
    }
    cachedDiscovery = { issuer, keys, expires: Date.now() + 300000 };
  }
  return verifyIdentityProfile(token, accessToken, {
    ...cachedDiscovery,
    audience,
  });
}

module.exports = { identityProfile, verifyIdentityProfile };
