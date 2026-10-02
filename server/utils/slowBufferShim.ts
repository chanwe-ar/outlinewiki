import buffer from "node:buffer";

/**
 * Node.js 25 removed the deprecated `buffer.SlowBuffer` export. Some transitive
 * dependencies (notably `buffer-equal-constant-time`, used by `jwa` / `jws` /
 * `jsonwebtoken`) still read `SlowBuffer.prototype` at module load time, which
 * crashes the process on startup. This shim restores a minimal stand-in when the
 * export is missing so that those modules can load. It is a no-op on versions of
 * Node.js that still provide `SlowBuffer`.
 *
 * This module must be imported before any module that may load the affected
 * dependencies.
 */
if (!("SlowBuffer" in buffer)) {
  const SlowBufferShim = function SlowBuffer() {
    // Intentionally empty, only the prototype is referenced by dependencies.
  };
  SlowBufferShim.prototype = buffer.Buffer.prototype;

  Object.defineProperty(buffer, "SlowBuffer", {
    value: SlowBufferShim,
    configurable: true,
    enumerable: false,
    writable: true,
  });
}
