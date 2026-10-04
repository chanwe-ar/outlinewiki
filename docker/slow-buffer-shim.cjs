/**
 * Node.js 25 removed the long-deprecated `buffer.SlowBuffer` export. Some
 * transitive dependencies — notably `buffer-equal-constant-time`, reached via
 * `jwa` / `jws` / `jsonwebtoken` — read `SlowBuffer.prototype` at module load
 * time, which crashes the process during startup on Node.js 25+.
 *
 * This file is a CommonJS preload (`node --require`) rather than application
 * code because the production image copies `build/` and `node_modules/` from
 * the prebuilt `outlinewiki/outline-base` image, so a shim imported from
 * `server/index.ts` is not present in the compiled bundle that actually runs.
 * Preloading also guarantees it runs before dd-trace's require hook pulls in
 * the affected modules.
 *
 * It is a no-op on versions of Node.js that still provide `SlowBuffer`.
 *
 * See also: server/utils/slowBufferShim.ts (same shim, for source builds).
 */
"use strict";

const buffer = require("node:buffer");

if (!("SlowBuffer" in buffer)) {
  const SlowBuffer = function SlowBuffer(size) {
    return buffer.Buffer.allocUnsafeSlow(size);
  };

  // A dedicated prototype object: dependencies only read and assign
  // `SlowBuffer.prototype.equal`, and routing that at Buffer.prototype would
  // let them mutate every Buffer in the process.
  SlowBuffer.prototype = Object.create(buffer.Buffer.prototype);

  Object.defineProperty(buffer, "SlowBuffer", {
    value: SlowBuffer,
    configurable: true,
    enumerable: false,
    writable: true,
  });
}
