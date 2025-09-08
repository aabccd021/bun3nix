#!/usr/bin/env bun

import * as path from "node:path";
import * as util from "node:util";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as child_process from "node:child_process";

async function packageTextPromise(pkg, cwd) {
  const [name, value] = pkg;
  const [val0, _val1, _val2, val3] = value;

  // git dependencies
  if (val3 === undefined) {
    const url = new URL(val0.replace(`${name}@`, "").replace("github:", "https://github.com/"));
    const bunTagFile = Bun.file(`${cwd}/node_modules/${name}/.bun-tag`);
    const bunTag = await bunTagFile.text();
    try {
      await bunTagFile.delete();
      const hash = child_process.execSync(`nix-hash --base64 --type sha512 --sri ${cwd}/node_modules/${name}`, { encoding: "utf-8" });
      return [
        `"${name}" = pkgs.fetchgit {`,
        `  url = "${url.origin}${url.pathname}";`,
        `  rev = "${url.hash.substring(1)}";`,
        `  hash = "${hash.trim()}";`,
        `};`,
      ];
    } finally {
      await bunTagFile.write(bunTag);
    }
  }

  // npm dependencies
  const tarballName = path.basename(val0).replaceAll("@", "-");
  return [
    `"${name}" = extractTarball (`,
    `  pkgs.fetchurl {`,
    `    url = "https://registry.npmjs.org/${name}/-/${tarballName}.tgz";`,
    `    hash = "${val3}";`,
    `  }`,
    `);`,
  ];
}

const arg = util.parseArgs({
  args: process.argv.slice(2),
  options: {
    postinstall: {
      type: "boolean",
      default: false,
    },
    package: {
      type: "string",
      multiple: true,
      default: [],
    }
  },
  strict: true,
});

if (arg.values.postinstall === false && arg.values.package.length === 0) {
  process.exit(1);
}

let cwd = process.cwd();
if (arg.values.package.length > 0) {
  cwd = await fs.mkdtemp(path.join(os.tmpdir(), "bun-nix-"));
  child_process.execSync(`bun add ${arg.values.package.join(" ")}`, { cwd });
}

const bunLockJsonc = await Bun.file(`${cwd}/bun.lock`).text();
const bunLockJson = bunLockJsonc.replace(/,(\s*[}\]])/g, "$1");
const bunLock = JSON.parse(bunLockJson);
const packageTextPromises = Object
  .entries(bunLock.packages)
  .map((pkg) => packageTextPromise(pkg, cwd));
const packageTexts = await Promise.all(packageTextPromises);

const packageText = packageTexts
  .flat()
  .filter((line) => line !== undefined)
  .map((line) => `    ${line}`)
  .join("\n");

console.log(`{ pkgs ? import <nixpkgs> {}, ... }:
let
  lib = pkgs.lib;
  extractTarball =
    src:
    pkgs.runCommand "extracted-\${src.name}" { } ''
      mkdir "$out"
      \${pkgs.libarchive}/bin/bsdtar -xf \${src} --strip-components 1 -C "$out"
    '';
  packages = {
${packageText}
  };
in
lib.pipe packages [
  (lib.mapAttrsToList (
    name: package: ''
      mkdir -p "$out/\${name}"
      cp -Lr \${package}/* "$out/\${name}"
    ''
  ))
  (lib.concatStringsSep "\\n")
  (pkgs.runCommand "node_modules" { })
]`);
