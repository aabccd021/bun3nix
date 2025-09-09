# :snowflake: bun3nix

Generate a Nix expression for your npm dependencies using Bun.

## Usage

Generate `npm_deps.nix` and import it in your Nix expression:

```sh
bun3nix install @tailwindcss/cli > ./npm_deps.nix
```

```nix
{ pkgs, ... }: {

  npm_deps = import ./npm_deps.nix { inherit pkgs; };

  my_drv = pkgs.runCommand "my_drv" { } ''
    ls ${npm_deps}/lib/node_modules # List installed modules
    ${npm_deps}/bin/tailwindcss # Use a binary from installed dependencies
  '';

}
```

## Generating nix expression

There are two subcommands to generate the Nix expression: `postinstall` and `install`.

### `postinstall` subcommand

Run this subcommand **after** running `bun install`.  
This subcommand assumes `bun.lock` are present in the current directory.
The `node_modules` should also be present if you use GitHub dependencies.

```sh
bun install is-even @types/bun # generates package.json, bun.lock, and node_modules
bun3nix postinstall > ./npm_deps.nix
```

Typically, you’d add this as a `postinstall` script in your `package.json` to ensure it always runs
after `bun install` and in the same directory as `package.json`:

```json
{
  "scripts": {
    "postinstall": "bun3nix postinstall > ./npm_deps.nix"
  }
}
```

### `install` subcommand

Use this subcommand if you don't need `package.json`, `bun.lock`, or `node_modules` in your project:

```sh
bun3nix install is-even @types/bun > ./npm_deps.nix

ls node_modules # doesn't exist
ls bun.lock # doesn't exist
ls package.json # doesn't exist
```

## Installation

### Pipe from `curl`

```sh
curl -fsSL https://raw.githubusercontent.com/aabccd021/bun3nix/refs/heads/main/index.js | bun - install is-even > ./npm_deps.nix
```

### Download and run

```sh
curl -fsSL https://raw.githubusercontent.com/aabccd021/bun3nix/refs/heads/main/index.js -o ./bun3nix.js
bun ./bun3nix.js install is-even > ./npm_deps.nix
```

### Executable script

```sh
# Ensure the 'bun' command is available
bun --version

curl -fsSL https://raw.githubusercontent.com/aabccd021/bun3nix/refs/heads/main/index.js -o ./bun3nix
chmod +x ./bun3nix
./bun3nix install is-even > ./npm_deps.nix
```

### Nix flake input

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
# All command below also works with `bun install` + `bun3nix postinstall`

# npm dependencies
bun3nix install is-even

# GitHub dependencies with `github:` prefix
bun3nix install github:lodash/lodash#8a26eb4

# GitHub dependencies with full URL
bun3nix install https://github.com/lodash/lodash

# GitHub dependencies with custom name
bun3nix install lorem@https://github.com/lodash/lodash
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
