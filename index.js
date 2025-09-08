#!/usr/bin/env bun

import * as path from "node:path";
import * as util from "node:util";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as child_process from "node:child_process";

async function packageTextPromise({ cwd, pkg, name, baseName, modulePath }) {
  const [val0, _val1, _val2, val3] = pkg;

  // git dependencies
  if (val3 === undefined) {
    const url = new URL(val0.replace(`${name}@`, "").replace("github:", "https://github.com/"));
    const bunTagFile = Bun.file(`${cwd}/node_modules/${modulePath}/.bun-tag`);
    const bunTag = await bunTagFile.text();
    try {
      await bunTagFile.delete();
      const hash = child_process.execSync(`nix-hash --base64 --type sha512 --sri ${cwd}/node_modules/${modulePath}`, { encoding: "utf-8" });
      return [
        `"${modulePath}" = pkgs.fetchgit {`,
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
    `"${modulePath}" = extractTarball (`,
    `  pkgs.fetchurl {`,
    `    url = "https://registry.npmjs.org/${baseName}/-/${tarballName}.tgz";`,
    `    hash = "${val3}";`,
    `  }`,
    `);`,
  ];
}

function serialize(cwd, obj) {
  let result;
  const dependencyEntries = Object.entries(obj)
    .map(([name, pkg]) => {
      const parentName = Object.keys(obj)
        .filter((n) => name.startsWith(`${n}/`) && n !== name)
        .sort((a, b) => b.length - a.length)
        .at(0);
      const baseName = parentName !== undefined ? name.substring(parentName.length + 1) : name;
      return [name, { parentName, baseName, pkg }]
    })

  const dependencyMap = Object.fromEntries(dependencyEntries)

  return Object.entries(dependencyMap)
    .map(([name, { baseName, pkg }]) => {
      const modulePaths = []
      let current = dependencyMap[name];
      while (current !== undefined) {
        modulePaths.push(current.baseName);
        current = dependencyMap[current.parentName];
      }
      const modulePath = modulePaths.reverse().join("/node_modules/");
      return packageTextPromise({ cwd, pkg, name, baseName, modulePath });
    })
}

const arg = util.parseArgs({
  args: process.argv.slice(2),
  options: {
    postinstall: {
      type: "boolean",
      default: false,
    },
  },
  allowPositionals: true,
  strict: true,
});

if (arg.values.postinstall === false && arg.positionals.length === 0) {
  console.error("Either --postinstall or package names must be provided");
  process.exit(1);
}

if (arg.values.postinstall && arg.positionals.length > 0) {
  console.error("Cannot provide both --postinstall and package names");
  process.exit(1);
}

let cwd = process.cwd();
if (arg.positionals.length > 0) {
  cwd = await fs.mkdtemp(path.join(os.tmpdir(), "bun-nix-"));
  child_process.execSync(`bun add ${arg.positionals.join(" ")}`, { cwd });
}

const bunLockJsonc = await Bun.file(`${cwd}/bun.lock`).text();
const bunLockJson = bunLockJsonc.replace(/,(\s*[}\]])/g, "$1");
const bunLock = JSON.parse(bunLockJson);
const packageTextPromises = serialize(cwd, bunLock.packages);
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
      chmod -R u+w "$out/\${name}"
    ''
  ))
  (lib.concatStringsSep "\\n")
  (pkgs.runCommand "node_modules" { })
]`);
