#!/usr/bin/env bash
set -eu

index_js="$(git rev-parse --show-toplevel)/index.js"

if ! command -v bun >/dev/null 2>&1; then
    PATH="$(nix build nixpkgs#bun --no-link --print-out-paths 2>/dev/null)/bin:$PATH"
    export PATH
fi

(
    echo "# --postinstall"

    tmpdir=$(mktemp -d)
    trap 'rm -rf $tmpdir' EXIT
    cd "$tmpdir" || exit 1

    bun install is-even@1.0.0 lodash@github:lodash/lodash#8a26eb4 @types/bun@1.2.21

    "$index_js" --postinstall >./node_modules.nix
    rm -rf ./node_modules
    cp -Lr "$(nix-build --no-out-link ./node_modules.nix)" ./node_modules
    chmod -R u+rwX ./node_modules

    {
        echo "import isEven from 'is-even';"
        echo "import _ from 'lodash';"
        echo "import { expect } from 'bun:test';"
        echo "expect(_.filter([1, 2, 3], isEven).at(0)).toEqual(2);"
    } >./test.ts

    nix run nixpkgs#bun ./test.ts
    nix run nixpkgs#typescript -- --noEmit ./test.ts
)

(
    echo "# --package"

    tmpdir=$(mktemp -d)
    trap 'rm -rf $tmpdir' EXIT
    cd "$tmpdir" || exit 1

    "$index_js" "github:lodash/lodash#8a26eb4" "@types/bun@1.2.21" "is-even@1.0.0" >./node_modules.nix
    rm -rf ./node_modules
    cp -Lr "$(nix-build --no-out-link ./node_modules.nix)" ./node_modules
    chmod -R u+rwX ./node_modules

    {
        echo "import isEven from 'is-even';"
        echo "import _ from 'lodash';"
        echo "import { expect } from 'bun:test';"
        echo "expect(_.filter([1, 2, 3], isEven).at(0)).toEqual(2);"
    } >./test.ts

    nix run nixpkgs#bun ./test.ts
    nix run nixpkgs#typescript -- --noEmit ./test.ts
)
