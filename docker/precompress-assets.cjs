"use strict";

/**
 * Writes maximum-quality .br and .gz siblings for Outline's static assets.
 *
 * Outline serves /static with koa-send, which picks `<file>.br` or
 * `<file>.gz` when the browser accepts it, and koa-compress then leaves the
 * response alone because Content-Encoding is already set (it still adds
 * `Vary: Accept-Encoding`). Without these files every first load compresses
 * the multi-megabyte bundle on the fly, at a lower quality, on the web
 * process's CPU.
 */

const fs = require("node:fs");
const path = require("node:path");
const zlib = require("node:zlib");

const ROOT = path.resolve(process.argv[2] || "build/app");
const COMPRESSIBLE = /\.(js|mjs|css|svg|json|webmanifest|txt)$/;
const MIN_BYTES = 1024;

let files = 0;
let before = 0;
let after = 0;

const walk = (dir) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    // `assets` is a compatibility symlink to the real directory.
    if (entry.isSymbolicLink()) {
      continue;
    }
    if (entry.isDirectory()) {
      walk(file);
      continue;
    }
    if (!COMPRESSIBLE.test(entry.name)) {
      continue;
    }
    const source = fs.readFileSync(file);
    if (source.length < MIN_BYTES) {
      continue;
    }
    const brotli = zlib.brotliCompressSync(source, {
      params: {
        [zlib.constants.BROTLI_PARAM_QUALITY]: zlib.constants.BROTLI_MAX_QUALITY,
        [zlib.constants.BROTLI_PARAM_SIZE_HINT]: source.length,
      },
    });
    const gzip = zlib.gzipSync(source, { level: zlib.constants.Z_BEST_COMPRESSION });
    // Only worth a second file when it saves something.
    if (brotli.length < source.length * 0.9) {
      fs.writeFileSync(`${file}.br`, brotli);
    }
    if (gzip.length < source.length * 0.9) {
      fs.writeFileSync(`${file}.gz`, gzip);
    }
    files += 1;
    before += source.length;
    after += Math.min(brotli.length, source.length);
  }
};

walk(ROOT);
const mb = (bytes) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;
console.log(`Precompressed ${files} assets: ${mb(before)} -> ${mb(after)} brotli`);
