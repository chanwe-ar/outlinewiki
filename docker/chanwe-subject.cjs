"use strict";

/**
 * Chanwines (2026-11-12): the Wiki tells Umami who the signed-in person is, so Espacios' collector can credit their
 * web minutes. Umami's distinct id must be the Identity subject, and the only thing Outline keeps that equals it is
 * the providerId of the person's `user_authentications` row for the `oidc` provider (Identity's `sub`). The page
 * cannot read it, so configure-outline-release.cjs adds `GET /auth/chanwe.subject`, served by `subjectHandler`, and
 * static/chanwe-umami.js hands the answer to Umami.
 */

// Identity subjects look like `usr_chanwe_owner_ana_gomez`; Umami keeps at most 50 characters of a distinct id.
const SUBJECT = /^[A-Za-z0-9_.:-]{1,50}$/;

/**
 * The person's Identity subject, or null when they have none, several, or one Umami could not keep.
 *
 * @param user the signed-in Outline user ({ id, teamId }).
 * @param models Outline's models (UserAuthentication, AuthenticationProvider).
 */
async function identitySubject(user, models) {
  if (!user || !user.id) return null;
  const rows = await models.UserAuthentication.findAll({
    where: { userId: user.id },
    include: [
      {
        model: models.AuthenticationProvider,
        as: "authenticationProvider",
        where: { name: "oidc", teamId: user.teamId },
        required: true,
      },
    ],
  });
  const subjects = [...new Set(rows.map((row) => String(row.providerId || "")))];
  return subjects.length === 1 && SUBJECT.test(subjects[0]) ? subjects[0] : null;
}

/**
 * The Koa handler of `GET /auth/chanwe.subject`: `{ subject }` for the session cookie's person, a 401 with no subject
 * otherwise. Read-only and never cached.
 */
function subjectHandler({ models, getUserForJWT }) {
  return async (ctx) => {
    ctx.set("Cache-Control", "no-store");
    const token = ctx.cookies.get("accessToken");
    let user = null;
    if (token) {
      try {
        ({ user } = await getUserForJWT(token, ["session"]));
      } catch {
        user = null;
      }
    }
    if (!user) {
      ctx.status = 401;
      ctx.body = { subject: null };
      return;
    }
    ctx.body = { subject: await identitySubject(user, models) };
  };
}

module.exports = { identitySubject, subjectHandler };
