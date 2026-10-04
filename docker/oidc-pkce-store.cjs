"use strict";

const crypto = require("node:crypto");

const cookieName = "__Host-outline-oidc-pkce";
const lifetime = 10 * 60 * 1000;
const cookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: "lax",
  path: "/",
  signed: false,
};

/**
 * Adds PKCE to the legacy image's state store without changing its CSRF checks.
 * The verifier stays in an authenticated, encrypted, host-only HTTPS cookie.
 */
class OIDCPKCEStore {
  /**
   * Creates a PKCE adapter for the prebuilt image's state store.
   *
   * @param legacyStore the original Outline state store.
   * @param secret the deployment's persistent encryption secret.
   */
  constructor(legacyStore, secret = process.env.SECRET_KEY) {
    if (!secret) {
      throw new Error("SECRET_KEY is required for OIDC PKCE");
    }
    this.legacyStore = legacyStore;
    this.encryptionKey = crypto
      .createHash("sha256")
      .update(`outline-oidc-pkce:${secret}`)
      .digest();
  }

  /**
   * Saves the verifier bound to the original OAuth state token.
   *
   * @param ctx the Koa context.
   * @param verifier the Passport-generated PKCE verifier.
   * @param state the application state.
   * @param meta the provider metadata.
   * @param callback the Passport completion callback.
   * @returns the legacy store result.
   */
  store(ctx, verifier, state, meta, callback) {
    if (typeof verifier !== "string" || verifier.length < 43) {
      return callback(new Error("OIDC PKCE verifier is required"));
    }
    return this.legacyStore.store(ctx, (error, token) => {
      if (error) {
        return callback(error);
      }
      const iv = crypto.randomBytes(12);
      const cipher = crypto.createCipheriv("aes-256-gcm", this.encryptionKey, iv);
      const payload = JSON.stringify({
        token,
        verifier,
        expires: Date.now() + lifetime,
      });
      const ciphertext = Buffer.concat([
        cipher.update(payload, "utf8"),
        cipher.final(),
      ]);
      const cookie = Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString(
        "base64url"
      );
      ctx.cookies.set(cookieName, cookie, { ...cookieOptions, maxAge: lifetime });
      callback(null, token);
    });
  }

  /**
   * Checks the original CSRF state and returns the matching PKCE verifier.
   *
   * @param ctx the Koa context.
   * @param token the state returned by the identity provider.
   * @param callback the Passport completion callback.
   * @returns the legacy store result.
   */
  verify(ctx, token, callback) {
    const cookie = ctx.cookies.get(cookieName, { signed: false });
    ctx.cookies.set(cookieName, null, cookieOptions);
    return this.legacyStore.verify(ctx, token, (error, valid, state) => {
      if (error || !valid) {
        return callback(error, false, state);
      }
      let payload;
      try {
        const data = Buffer.from(cookie || "", "base64url");
        const decipher = crypto.createDecipheriv(
          "aes-256-gcm",
          this.encryptionKey,
          data.subarray(0, 12)
        );
        decipher.setAuthTag(data.subarray(12, 28));
        payload = JSON.parse(
          Buffer.concat([
            decipher.update(data.subarray(28)),
            decipher.final(),
          ]).toString("utf8")
        );
        if (
          payload.token !== token ||
          !Number.isFinite(payload.expires) ||
          payload.expires <= Date.now() ||
          typeof payload.verifier !== "string" ||
          payload.verifier.length < 43
        ) {
          throw new Error("Invalid PKCE state");
        }
      } catch {
        return callback(
          new Error("OIDC PKCE state is missing, expired, or invalid"),
          false,
          state
        );
      }
      callback(null, payload.verifier, state);
    });
  }
}

module.exports = { OIDCPKCEStore };
