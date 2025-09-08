#!/usr/bin/env bash
set -eu

tmpdir=$(mktemp -d)
cp "$(git rev-parse --show-toplevel)/index.js" "$tmpdir/bun2node_modules"
PATH="$tmpdir:$PATH"
export PATH

setup_test() {
    tmpdir=$(mktemp -d)
    trap 'rm -rf $tmpdir' EXIT
    cd "$tmpdir" || exit 1
}

if ! command -v bun >/dev/null 2>&1; then
    bun_pkg=$(nix build nixpkgs#bun --no-link --print-out-paths)
    PATH="$bun_pkg/bin:$PATH"
    export PATH
fi

(
    echo "# --postinstall"
    setup_test

    bun install is-even@1.0.0 lodash@github:lodash/lodash#8a26eb4 @types/bun@1.2.21

    bun2node_modules --postinstall >./node_modules.nix
    rm -rf ./node_modules
    cp -Lr "$(nix-build --no-out-link ./node_modules.nix)/lib/node_modules" ./node_modules
    chmod -R u+rwX ./node_modules

    echo '
      import isEven from "is-even";
      import _ from "lodash";
      import { expect } from "bun:test";
      expect(_.filter([1, 2, 3], isEven).at(0)).toEqual(2);
    ' >./test.ts
    nix run nixpkgs#bun ./test.ts
    nix run nixpkgs#typescript -- --noEmit ./test.ts
)

(
    echo "# packages as arguments"
    setup_test

    bun2node_modules github:lodash/lodash#8a26eb4 @types/bun@1.2.21 is-even@1.0.0 >./node_modules.nix
    for path in ./node_modules ./package.json ./bun.lock ./bun.lockb; do
        if [ -e "$path" ]; then
            echo "$path should not exist"
            exit 1
        fi
    done
    cp -Lr "$(nix-build --no-out-link ./node_modules.nix)/lib/node_modules" ./node_modules
    chmod -R u+rwX ./node_modules

    echo '
      import isEven from "is-even";
      import _ from "lodash";
      import { expect } from "bun:test";
      expect(_.filter([1, 2, 3], isEven).at(0)).toEqual(2);
    ' >./test.ts
    nix run nixpkgs#bun ./test.ts
    nix run nixpkgs#typescript -- --noEmit ./test.ts
)
