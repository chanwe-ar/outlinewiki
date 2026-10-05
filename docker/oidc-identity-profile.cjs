"use strict";

const crypto = require("node:crypto");
const jwt = require("jsonwebtoken");

let cachedDiscovery;

// Identity mints the wiki's access token for this resource audience, and only
// with this scope when the person holds the Wiki in their Platform grant.
const DEFAULT_RESOURCE_AUDIENCE = "chanwe-wiki-api";
const DEFAULT_REQUIRED_SCOPE = "wiki:access";

/**
 * Finds the Identity public key that signed a token.
 *
 * @param token the compact JWT.
 * @param keys the trusted public signing keys.
 * @param kind the token's name, for errors.
 * @returns the public key.
 */
function signingKey(token, keys, kind) {
  const decoded = jwt.decode(token, { complete: true });
  if (!decoded || decoded.header.alg !== "RS256") {
    throw new Error(`Identity returned an unsupported ${kind}`);
  }
  const jwk = keys.find(
    (key) =>
      key.kid === decoded.header.kid &&
      key.kty === "RSA" &&
      (!key.use || key.use === "sig") &&
      (!key.alg || key.alg === "RS256")
  );
  if (!jwk) {
    throw new Error("Identity signing key was not found");
  }
  return crypto.createPublicKey({ key: jwk, format: "jwk" });
}

/**
 * Verifies that the access token from the same exchange is an Identity token
 * for the wiki resource, for the same person, carrying the wiki scope. Identity
 * already refuses the wiki to anyone outside the CHANWE Platform; checking the
 * grant here as well means a sign-in only creates or opens an account when
 * Identity says this person may use the Wiki.
 *
 * @param accessToken the access token returned by the code exchange.
 * @param subject the verified ID token subject.
 * @param configuration the trusted issuer, keys, client, resource audience and scope.
 */
function verifyWikiGrant(accessToken, subject, configuration) {
  const grant = jwt.verify(
    accessToken,
    signingKey(accessToken, configuration.keys, "access token"),
    {
      algorithms: ["RS256"],
      issuer: configuration.issuer,
      audience: configuration.resourceAudience,
    }
  );
  const scopes =
    typeof grant === "object" && typeof grant.scope === "string"
      ? grant.scope.split(" ")
      : [];
  if (
    typeof grant !== "object" ||
    !Number.isFinite(grant.exp) ||
    grant.sub !== subject ||
    (grant.client_id && grant.client_id !== configuration.audience) ||
    !scopes.includes(configuration.requiredScope)
  ) {
    throw new Error("Identity has not granted this account access to the Wiki");
  }
}

/**
 * Verifies an Identity ID token before using its standard profile claims, and
 * the access token's Wiki grant when a resource audience is configured.
 *
 * @param token the ID token returned by the code exchange.
 * @param accessToken the access token returned in the same exchange.
 * @param configuration the trusted issuer, audience, public signing keys and,
 *   optionally, the wiki resource audience and required scope.
 * @returns the verified identity profile.
 */
function verifyIdentityProfile(token, accessToken, configuration) {
  const profile = jwt.verify(
    token,
    signingKey(token, configuration.keys, "ID token"),
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
  if (configuration.resourceAudience) {
    verifyWikiGrant(accessToken, profile.sub, configuration);
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
  const kids = [token, accessToken].map(
    (value) => jwt.decode(value, { complete: true })?.header?.kid
  );
  if (
    !cachedDiscovery ||
    cachedDiscovery.issuer !== issuer ||
    cachedDiscovery.expires < Date.now() ||
    !kids.every((kid) => cachedDiscovery.keys.some((key) => key.kid === kid))
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
    resourceAudience:
      process.env.OIDC_ACCESS_TOKEN_AUDIENCE || DEFAULT_RESOURCE_AUDIENCE,
    requiredScope: process.env.OIDC_REQUIRED_SCOPE || DEFAULT_REQUIRED_SCOPE,
  });
}

module.exports = { identityProfile, verifyIdentityProfile };
