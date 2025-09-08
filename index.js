#!/usr/bin/env bun

import * as path from "node:path";
import * as util from "node:util";
import { $ } from "bun";

async function packageTextPromise([name, value]) {
  const [val0, _val1, _val2, val3] = value;

  // git dependencies
  if (val3 === undefined) {
    const url = new URL(val0.replace(`${name}@`, "").replace("github:", "https://github.com/"));
    const bunTagFile = Bun.file(`node_modules/${name}/.bun-tag`);
    const bunTag = await bunTagFile.text();
    try {
      await bunTagFile.delete();
      const hash = await $`nix-hash --base64 --type sha512 --sri node_modules/${name}`.text();
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

const { values: args } = util.parseArgs({
  args: process.argv.slice(2),
  options: {
    postinstall: {
      type: "boolean",
    },
  },
  strict: true,
});

const bunLockJsonc = await Bun.file("bun.lock").text();
const bunLockJson = bunLockJsonc.replace(/,(\s*[}\]])/g, "$1");
const bunLock = JSON.parse(bunLockJson);
const packageTextPromises = Object.entries(bunLock.packages).map(packageTextPromise);
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
