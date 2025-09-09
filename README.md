# :snowflake: bun3nix

Generate a Nix expression for your npm dependencies using Bun.

## Usage

Reference the generated `npm_deps.nix` in your Nix expression:

```nix
{ pkgs, ... }: {

  npm_deps = import ./npm_deps.nix { inherit pkgs; };

  my_drv = pkgs.runCommand "my_drv" { } ''
    # List installed modules
    ls ${npm_deps}/lib/node_modules

    # Use a binary from installed dependencies
    ${npm_deps}/bin/mycli
  '';

}
```

## Subcommands

### `postinstall`

Run this subcommand **after** running `bun install`.  
It assumes `node_modules` and `bun.lock` are present in the current directory.

```sh
bun install is-even @types/bun # generates package.json, bun.lock, and node_modules
bun3nix postinstall > ./npm_deps.nix
```

Typically, you’d add this as a `postinstall` script in your `package.json` to ensure it always runs
in the same directory as `package.json`:

```json
{
  "scripts": {
    "postinstall": "bun3nix postinstall > ./npm_deps.nix"
  }
}
```

### `install`

Use this subcommand if you do **not** need `package.json`, `bun.lock`, or `node_modules` in your
project:

```sh
bun3nix install is-even @types/bun > ./npm_deps.nix
```

## Installation

### 1. Pipe from `curl`

```sh
curl -fsSL https://raw.githubusercontent.com/aabccd021/bun3nix/refs/heads/main/index.js | bun - install is-even > ./npm_deps.nix
```

### 2. Download and run

```sh
curl -fsSL https://raw.githubusercontent.com/aabccd021/bun3nix/refs/heads/main/index.js -o ./bun3nix.js
bun ./bun3nix.js install is-even > ./npm_deps.nix
```

### 3. Executable script

```sh
# Ensure the 'bun' command is available
bun --version

curl -fsSL https://raw.githubusercontent.com/aabccd021/bun3nix/refs/heads/main/index.js -o /usr/local/bin/bun3nix
chmod +x /usr/local/bin/bun3nix
/usr/local/bin/bun3nix install is-even > ./npm_deps.nix

# If `/usr/local/bin` is in your $PATH, you can just run:
bun3nix install is-even > ./npm_deps.nix
```

### 4. Nix flake input

```nix
{
  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
  inputs.bun3nix = {
    url = "https://raw.githubusercontent.com/aabccd021/bun3nix/refs/heads/main/index.js";
    flake = false;
  };

  outputs = inputs:
    let
      pkgs = inputs.nixpkgs.legacyPackages.x86_64-linux;
    in
    {
      packages.x86_64-linux.bun3nix = pkgs.writeShellScriptBin "bun3nix" ''
        exec ${pkgs.bun}/bin/bun ${inputs.bun3nix} "$@"
      '';
    };
}
```

## Supported dependencies

Currently, only **npm** and **GitHub** dependencies are supported.  
Contributions are welcome to add support for other sources!

```sh
# npm dependencies
bun install is-even

# GitHub dependencies
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
