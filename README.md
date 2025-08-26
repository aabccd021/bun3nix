# bun2nix

Generate node_modules.nix from bun.lock

## Usage

Add `postinstall` script to your `package.json`, then run `bun install`.

```json
{
  "scripts": {
    "postinstall": "nix run github:aabccd021/bun2nix > node_modules.nix"
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

## Supported dependencies

Currently npm and github dependencies are supported.

```sh
# npm dependencies
bun install is-even@1.0.0

# github dependencies
bun install lodash@github:lodash/lodash#8a26eb4
bun install lodash@https://github.com/lodash/lodash
```

## Speeding up download

You might be able to speed up the download of `bun2nix` by using `--inputs-from .`
if you already have a `flake.nix` in your project:

```sh
nix run --inputs-from . github:aabccd021/bun2nix > node_modules.nix
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
