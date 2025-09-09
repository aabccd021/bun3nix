# :snowflake: bun3nix

Generate Nix expressions from Bun dependencies.

## Usage

Generate `npm_deps.nix`

```sh
nix run nixpkgs#bun install cowsay
nix run github:aabccd021/bun3nix postinstall > ./npm_deps.nix
```

Build it with `nix-build`:

```sh
nix-build ./npm_deps.nix
ls ./result/lib/node_modules
./result/bin/cowsay hello

```

Import it in your own Nix expressions:

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
bun install github:lodash/lodash#8a26eb4

# github dependencies with full URL
bun install https://github.com/lodash/lodash

# github dependencies with custom name
bun install lorem@https://github.com/lodash/lodash
```

## Usage example with Tailwind CSS

The `@tailwindcss/node` package [respects `NODE_PATH` to locate plugins](https://github.com/tailwindlabs/tailwindcss/blob/2f1cbbfed28729798eebdaa57935e8f7b0c622e1/packages/%40tailwindcss-node/src/compile.ts#L207).

So ideally, you can use `bun3nix` to install Tailwind CSS plugins and run `tailwindcss` with those
plugins:

```sh
nix run github:aabccd021/bun3nix install daisyui > tailwindcss_plugins.nix
```

```nix
{ pkgs, ... }: rec {

  tailwindcss_plugins = import ./tailwindcss_plugins.nix { inherit pkgs; };

  tailwindcss_with_plugins = pkgs.writeShellApplication {
    name = "tailwindcss";
    runtimeEnv.NODE_PATH = "${tailwindcss_plugins}/lib/node_modules";
    text = ''
      exec ${pkgs.tailwindcss_4}/bin/tailwindcss "$@"
    '';
  };

}
```

Unfortunately, this doesn't work with some plugins.
From my testing, it works with `daisyui` but not with `@iconify/tailwind4`.

As a workaround, you can use `bun3nix` to install `@tailwindcss/cli`.

```sh
nix run github:aabccd021/bun3nix install daisyui > tailwindcss_plugins.nix
nix run github:aabccd021/bun3nix install tailwindcss  @tailwindcss/cli > tailwindcss.nix
```

```nix
{ pkgs, ... }: rec {

  tailwindcss = import ./tailwindcss.nix { inherit pkgs; };
  tailwindcss_plugins = import ./tailwindcss_plugins.nix { inherit pkgs; };

  tailwindcss_with_plugins = pkgs.writeShellApplication {
    name = "tailwindcss";
    runtimeEnv.NODE_PATH = "${tailwindcss_plugins}/lib/node_modules";
    text = ''
      exec ${tailwindcss}/bin/tailwindcss "$@"
    '';
  };
}
```

Or you can install everything in one go:

```sh
nix run github:aabccd021/bun3nix install @tailwindcss/cli tailwindcss daisyui > tailwindcss_deps.nix
```

```nix
{ pkgs, ... }: rec {

    tailwindcss_deps = import ./tailwindcss_deps.nix { inherit pkgs; };

    tailwindcss_with_plugins = pkgs.writeShellApplication {
      name = "tailwindcss";
      runtimeEnv.NODE_PATH = "${tailwindcss_deps}/lib/node_modules";
      text = ''
        exec ${tailwindcss_deps}/bin/tailwindcss "$@"
      '';
    };
}
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
