#!/usr/bin/env bun

// TODO rename pkg to lockInfo
// TODO remove unused val1 and val2, and instead use index access
// TODO don't use val0, val1, val2, val3 if possible
// TODO don't use module_path
// TODO --output

import * as child_process from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import * as util from "node:util";

function mkFetchText({ cwd, pkg, name, baseName, modulePath }) {
  const [val0, _val1, _val2, val3] = pkg;

  // git dependencies
  if (val3 === undefined) {
    const url = new URL(val0.replace(`${name}@`, "").replace("github:", "https://github.com/"));
    const bunTag = fs.readFileSync(`${cwd}/node_modules/${modulePath}/.bun-tag`, "utf-8");
    try {
      fs.rmSync(`${cwd}/node_modules/${modulePath}/.bun-tag`);
      const hash = child_process.execSync(
        `nix-hash --base64 --type sha512 --sri ${cwd}/node_modules/${modulePath}`,
        { encoding: "utf-8" },
      );
      return [
        `"${modulePath}" = pkgs.fetchgit {`,
        `  url = "${url.origin}${url.pathname}";`,
        `  rev = "${url.hash.substring(1)}";`,
        `  hash = "${hash.trim()}";`,
        `};`,
      ];
    } finally {
      fs.writeFileSync(`${cwd}/node_modules/${modulePath}/.bun-tag`, bunTag);
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
  cwd = fs.mkdtempSync(path.join(os.tmpdir(), "bun-nix-"));
  child_process.execSync(`bun add ${arg.positionals.join(" ")}`, { cwd });
}

const bunLockJsonc = fs.readFileSync(path.join(cwd, "bun.lock"), "utf-8");
const bunLockJson = bunLockJsonc.replace(/,(\s*[}\]])/g, "$1");
const bunLock = JSON.parse(bunLockJson);

const dependencyMap = Object.fromEntries(
  Object.entries(bunLock.packages).map(([name, pkg]) => {
    const parentName = Object.keys(bunLock.packages)
      .filter((n) => name.startsWith(`${n}/`) && n !== name)
      .sort((a, b) => b.length - a.length)
      .at(0);
    const baseName = parentName !== undefined ? name.substring(parentName.length + 1) : name;
    return [name, { parentName, baseName, pkg }];
  }),
);

const pkgsInfos = Object.entries(dependencyMap).map(([name, { baseName, pkg }]) => {
  const modulePaths = [];
  let current = dependencyMap[name];
  while (current !== undefined) {
    modulePaths.push(current.baseName);
    current = dependencyMap[current.parentName];
  }
  const modulePath = modulePaths.reverse().join("/node_modules/");
  return { pkg, name, baseName, modulePath };
});

const fetchText = pkgsInfos
  .flatMap((i) => mkFetchText({ ...i, cwd }))
  .filter((line) => line !== undefined)
  .map((line) => `    ${line}`)
  .join("\n");

const binText = pkgsInfos
  .flatMap(({ pkg, modulePath }) => {
    const [_val0, _val1, val2, _val3] = pkg;
    if (val2?.bin === undefined) {
      return [];
    }
    return Object.entries(val2.bin).flatMap(([binName, binPath]) => [
      `    patchShebangs --host "$out/lib/node_modules/${modulePath}/${binPath}"`,
      `    ln -s "$out/lib/node_modules/${modulePath}/${binPath}" "$out/lib/node_modules/.bin/${binName}"`,
    ]);
  })
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
${fetchText}
  };
  packageCommands = lib.pipe packages [
    (lib.mapAttrsToList (
      name: package: ''
        mkdir -p "$out/lib/node_modules/\${name}"
        cp -Lr \${package}/* "$out/lib/node_modules/\${name}"
        chmod -R u+w "$out/lib/node_modules/\${name}"
      ''
    ))
    (lib.concatStringsSep "\\n")
  ];
in
  (pkgs.runCommand "node_modules" {
    buildInputs = [ pkgs.nodejs ];
  } ''
    \${packageCommands}
    mkdir -p "$out/lib/node_modules/.bin"
${binText}
    ln -s "$out/lib/node_modules/.bin" "$out/bin"
  '')
`);
