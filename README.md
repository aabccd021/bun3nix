# :snowflake: bun3nix

Npm dependencies codegen using Bun.

## Usage

Generate `npm_deps.nix` and build it with `nix-build`:

```sh
nix run nixpkgs#bun install cowsay
nix run github:aabccd021/bun3nix postinstall > ./npm_deps.nix

nix-build ./npm_deps.nix
ls ./result/lib/node_modules
./result/bin/cowsay hello
```

Or import it in your own Nix expressions:

```nix
{ pkgs, ... }: {

  npm_deps = import ./npm_deps.nix { inherit pkgs; };

  my_drv = pkgs.runCommand "my_drv" { } ''
    ls ${npm_deps}/lib/node_modules
    ${npm_deps}/bin/cowsay hello
    touch "$out"
  '';

}
```

## Subcommands

### `postinstall` subcommand

Run this subcommand **after** running `bun install`.  
This subcommand assumes `bun.lock` are present in the current directory.
The `node_modules` should also be present if you use github dependencies.

```sh
nix run nixpkgs#bun install is-even @types/bun # generates package.json, bun.lock, and node_modules
nix run github:aabccd021/bun3nix postinstall > ./npm_deps.nix
```

Typically, you’d add this as a `postinstall` script in your `package.json` to ensure it always runs
after `bun install` and in the same directory as `package.json`:

```json
{
  "scripts": {
    "postinstall": "nix run github:aabccd021/bun3nix postinstall > ./npm_deps.nix"
  }
}
```

### `install` subcommand

Use this subcommand if you don't want to have any of `package.json`, `bun.lock`, or `node_modules`
in your project:

```sh
nix run github:aabccd021/bun3nix install is-even @types/bun > ./npm_deps.nix

ls node_modules # doesn't exist
ls bun.lock # doesn't exist
ls package.json # doesn't exist
```

## Supported dependencies

Currently, only npm and github dependencies are supported.  
Contributions are welcome to add support for other sources!

```sh
# All command below also works with `bun install` + `bun3nix postinstall`

# npm dependencies
bun install lodash

# github dependencies with `github:` prefix
bun github:lodash/lodash#8a26eb4

# github dependencies with full URL
bun install https://github.com/lodash/lodash

# github dependencies with custom name
bun install lorem@https://github.com/lodash/lodash
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
