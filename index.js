import * as path from "node:path";
import { $ } from "bun";

async function packageStrPromise([name, value]) {
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
    `"${name}" = extract (`,
    `  pkgs.fetchurl {`,
    `    url = "https://registry.npmjs.org/${name}/-/${tarballName}.tgz";`,
    `    hash = "${val3}";`,
    `  }`,
    `);`,
  ];
}

const jsonc = await Bun.file("bun.lock").text();
const json = jsonc.replace(/,(\s*[}\]])/g, "$1");
const lockfile = JSON.parse(json);
const packageStrPromises = Object.entries(lockfile.packages).map(packageStrPromise);
const packageStrList = await Promise.all(packageStrPromises);

const packageStr = packageStrList
  .flat()
  .filter((line) => line !== undefined)
  .map((line) => `    ${line}`)
  .join("\n");

console.log(`{ pkgs }:
let
  lib = pkgs.lib;
  extract =
    src:
    pkgs.runCommand "extracted-\${src.name}" { } ''
      mkdir -p "$out"
      \${pkgs.libarchive}/bin/bsdtar \\
        --extract \\
        --file "\${src}" \\
        --directory "$out" \\
        --strip-components=1 \\
        --no-same-owner \\
        --no-same-permissions
      chmod -R a+X "$out"
    '';
  packages = {
${packageStr}
  };
  mergePackages = lib.pipe packages [
    (lib.mapAttrsToList (
      name: pkg: ''
        mkdir -p "$out/\${name}"
        cp -Lr \${pkg}/* "$out/\${name}"
      ''
    ))
    (lib.concatStringsSep "\\n")
  ];
in
pkgs.runCommand "node_modules" { } ''
  mkdir -p "$out"
  \${mergePackages}
''`);
