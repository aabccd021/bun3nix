#!/usr/bin/env bun

import * as child_process from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

let cwd = process.cwd();

const [subcommand, ...args] = process.argv.slice(2);
if (subcommand === "install") {
  if (args.length === 0) {
    process.exit(1);
  }
  const tmpdir = fs.mkdtempSync(`${os.tmpdir()}/bun3nix-`);
  process.on("exit", () => fs.rmSync(tmpdir, { recursive: true, force: true }));
  cwd = tmpdir;
  child_process.execSync(`${process.argv[0]} add ${args.join(" ")}`, { cwd });
} else if (subcommand !== "postinstall") {
  process.exit(1);
}

const bunLockJson = fs.readFileSync(`${cwd}/bun.lock`, "utf-8").replace(/,(\s*[}\]])/g, "$1");
const bunLock = JSON.parse(bunLockJson);

const packages = Object.entries(bunLock.packages).map(([name, lockInfo]) => {
  let modulePath = "";
  let baseName;
  let currentName = name;
  while (currentName) {
    const depName = Object.keys(bunLock.packages)
      .filter((n) => currentName.startsWith(`${n}/`) && n !== currentName)
      .sort((a, b) => b.length - a.length)
      .at(0);
    const currentBaseName = depName ? currentName.substring(depName.length + 1) : currentName;
    modulePath += `node_modules/${currentBaseName}/${modulePath}`;
    baseName = baseName ?? currentBaseName;
    currentName = depName;
  }
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
    const bunTag = fs.readFileSync(`${cwd}/${modulePath}/.bun-tag`, "utf-8");
    try {
      fs.rmSync(`${cwd}/${modulePath}/.bun-tag`);
      const hash = child_process.execSync(
        `nix-hash --base64 --type sha512 --sri ${cwd}/${modulePath}`,
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
      fs.writeFileSync(`${cwd}/${modulePath}/.bun-tag`, bunTag);
    }
  }

  throw new Error(`bun3nix does not support the following dependency: ${nameUrl}`);
});

const binTextLines = packages.flatMap(({ lockInfo, modulePath }) => {
  const bins = lockInfo[2].bin;
  if (!bins) {
    return [];
  }
  return Object.entries(bins).flatMap(([binName, binPath]) => [
    `patchShebangs --host "$out/lib/${modulePath}/${binPath}"`,
    `ln -s "$out/lib/${modulePath}/${binPath}" "$out/lib/node_modules/.bin/${binName}"`,
  ]);
});

process.stdout.write(`{
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
      modulePath: package: ''
        mkdir -p "$out/lib/\${modulePath}"
        cp -Lr \${package}/* "$out/lib/\${modulePath}"
        chmod -R u+w "$out/lib/\${modulePath}"
      ''
    ))
    (lib.concatStringsSep "\\n")
  ];
in
(pkgs.runCommand "node_modules" { buildInputs = [ pkgs.nodejs ]; } ''
  \${packageCommands}
  mkdir -p "$out/lib/node_modules/.bin"${binTextLines.map((line) => `\n  ${line}`).join("")}
  ln -s "$out/lib/node_modules/.bin" "$out/bin"
'')
`);
