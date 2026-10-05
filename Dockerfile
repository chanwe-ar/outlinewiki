# Use the released application, rather than outline-base:latest's stale build.
FROM outlinewiki/outline:1.10.1

USER root
WORKDIR /opt/outline

# Preserve compatibility with dependencies that still reference SlowBuffer.
COPY --chown=nodejs:nodejs docker/slow-buffer-shim.cjs ./docker/slow-buffer-shim.cjs
ENV NODE_OPTIONS="--require=/opt/outline/docker/slow-buffer-shim.cjs"

# Chanwe Identity requires PKCE and returns profile claims in its ID token.
# Outline's native state store now handles PKCE; retain strict ID-token checks.
COPY --chown=nodejs:nodejs docker/oidc-identity-profile.cjs docker/configure-outline-release.cjs ./docker/
RUN node docker/configure-outline-release.cjs

USER nodejs
