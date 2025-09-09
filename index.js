#!/usr/bin/env bun

import * as child_process from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

let cwd = process.cwd();

const [subcommand, ...args] = process.argv.slice(2);
if (subcommand === "install") {
  if (args.length === 0) {
    console.error("Usage: bun3nix install <package>...");
    process.exit(1);
  }
  cwd = fs.mkdtempSync(`${os.tmpdir()}/bun3nix-`);
  child_process.execSync(`bun add ${args.join(" ")}`, { cwd });
} else if (subcommand !== "postinstall") {
  console.error("Usage: bun3nix <install|postinstall> [args]");
  process.exit(1);
}

const bunLockJson = fs.readFileSync(`${cwd}/bun.lock`, "utf-8").replace(/,(\s*[}\]])/g, "$1");
const bunLock = JSON.parse(bunLockJson);

const packages = Object.entries(bunLock.packages).map(([name, lockInfo]) => {
  const modulePaths = [];
  let baseName;
  let iterName = name;
  while (iterName) {
    const depName = Object.keys(bunLock.packages)
      .filter((n) => iterName.startsWith(`${n}/`) && n !== iterName)
      .sort((a, b) => b.length - a.length)
      .at(0);
    const iterBaseName = depName ? iterName.substring(depName.length + 1) : iterName;
    modulePaths.push(iterBaseName);
    baseName = baseName ?? iterBaseName;
    iterName = depName;
  }
  const modulePath = modulePaths.reverse().join("/node_modules/");
  return { baseName, modulePath, lockInfo };
});

const fetchTextLines = packages.flatMap(({ baseName, modulePath, lockInfo }) => {
  const nameUrl = lockInfo[0];
  const hash = lockInfo[3];

  const isNpmDep = hash !== undefined;
  if (isNpmDep) {
    const tarballName = path.basename(nameUrl).replaceAll("@", "-");
    return [
      `"${modulePath}" = extractTarball (`,
      `  pkgs.fetchurl {`,
      `    url = "https://registry.npmjs.org/${baseName}/-/${tarballName}.tgz";`,
      `    hash = "${hash}";`,
      `  }`,
      `);`,
    ];
  }

  const identifier = nameUrl.substring(nameUrl.lastIndexOf("@") + 1);
  const isGithubDep = identifier.startsWith("github:");
  if (isGithubDep) {
    const url = new URL(identifier.replace("github:", "https://github.com/"));
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

  throw new Error(`bun3nix does not support the following dependency: ${nameUrl}`);
});

const binTextLines = packages.flatMap(({ lockInfo, modulePath }) => {
  const bins = lockInfo[2].bin;
  return bins
    ? Object.entries(bins).flatMap(([binName, binPath]) => [
        `patchShebangs --host "$out/lib/node_modules/${modulePath}/${binPath}"`,
        `ln -s "$out/lib/node_modules/${modulePath}/${binPath}" "$out/lib/node_modules/.bin/${binName}"`,
      ])
    : [];
});

console.log(`{
  pkgs ? import <nixpkgs> { },
  ...
}:
let
  lib = pkgs.lib;
  extractTarball =
    src:
    pkgs.runCommand "extracted-\${src.name}" { } ''
      mkdir "$out"
      \${pkgs.libarchive}/bin/bsdtar -xf \${src} --strip-components 1 -C "$out"
    '';
  packages = {
${fetchTextLines.map((line) => `    ${line}`).join("\n")}
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
(pkgs.runCommand "node_modules" { buildInputs = [ pkgs.nodejs ]; } ''
  \${packageCommands}
  mkdir -p "$out/lib/node_modules/.bin"${binTextLines.map((line) => `\n  ${line}`).join("")}
  ln -s "$out/lib/node_modules/.bin" "$out/bin"
'')`);
