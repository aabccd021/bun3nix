set -eu

index_js="$(git rev-parse --show-toplevel)/index.js"

tmpdir=$(mktemp -d)
trap 'rm -rf $tmpdir' EXIT
cd "$tmpdir" || exit 1

nix run nixpkgs#bun install is-even@1.0.0 lodash@github:lodash/lodash#8a26eb4 @types/bun@1.2.21

nix run nixpkgs#bun run "$index_js" >./node_modules.nix
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
