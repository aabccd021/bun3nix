# bun2node_modules

Generate `node_modules.nix` from `bun.lock`.

## Usage

Add `postinstall` script to your `package.json`, then run `bun install`.

```json
{
  "scripts": {
    "postinstall": "curl -fsSL https://raw.githubusercontent.com/aabccd021/bun2node_modules/refs/heads/main/index.js | bun - --postinstall > ./node_modules.nix"
  }
}
```

Use the generated `node_modules.nix` from your nix expression:

```nix
{ pkgs, ... }:
{
  node_modules = import ./node_modules.nix { inherit pkgs; };

  dependencyCount = pkgs.runCommand "count-deps" { } ''
    count=$(ls ${node_modules} | wc -l)
    echo "There are $count dependencies" > "$out"
  '';
}
```

## Using the JS file as flake input

Here is how I personally do it

```nix
{
  inputs.bun2node_modules = {
    url = "https://raw.githubusercontent.com/aabccd021/bun2node_modules/refs/heads/main/index.js";
    flake = false;
  };

  outputs = inputs:
  let
    pkgs = inputs.nixpkgs.legacyPackages.x86_64-linux;
  in
  {
    packages.x86_64-linux.postinstall = pkgs.writeShellScriptBin "postinstall" ''
      exec ${pkgs.bun}/bin/bun ${inputs.bun2node_modules} > ./node_modules.nix
    '';
  };
}
```

```json
{
  "scripts": {
    "postinstall": "nix run .#postinstall"
  }
}
```

## Supported dependencies

Currently npm and github dependencies are supported.

```sh
# npm dependencies
bun install is-even@1.0.0

# github dependencies
bun install lodash@github:lodash/lodash#8a26eb4
bun install lodash@https://github.com/lodash/lodash
```

## LICENCE

```
Zero-Clause BSD
=============

Permission to use, copy, modify, and/or distribute this software for
any purpose with or without fee is hereby granted.

THE SOFTWARE IS PROVIDED “AS IS” AND THE AUTHOR DISCLAIMS ALL
WARRANTIES WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES
OF MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLEs
FOR ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY
DAMAGES WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN
AN ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT
OF OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
```
