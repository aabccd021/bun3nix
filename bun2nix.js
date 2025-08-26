import * as path from "node:path";
import { $ } from "bun";
import { parse } from "jsonc-parser";

async function depStr([name, value]) {
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

const lockfile = parse(await Bun.file("bun.lock").text());

const depsStrArr = await Promise.all(Object.entries(lockfile.packages).map(depStr));

const depsStr = depsStrArr
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
${depsStr}
  };
  mergePackages = lib.pipe packages [
    (lib.mapAttrsToList (
      name: pkg: ''
        mkdir --parents "$out/\${name}"
        cp --recursive --dereference \${pkg}/* "$out/\${name}"
      ''
    ))
    (lib.concatStringsSep "\\n")
  ];
in
pkgs.runCommand "node_modules" { } ''
  mkdir --parents "$out"
  \${mergePackages}
''`);
