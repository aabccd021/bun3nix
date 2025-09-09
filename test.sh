#!/usr/bin/env bash
set -eu

bun3nix="$(git rev-parse --show-toplevel)/index.js"

setup_test() {
  tmpdir=$(mktemp -d)
  trap 'rm -rf $tmpdir' EXIT
  cd "$tmpdir" || exit 1
}

(
  echo "# postinstall: success"
  setup_test

  nix run nixpkgs#bun install \
    is-even@1.0.0 \
    @types/bun@1.2.21 \
    github:lodash/lodash#8a26eb4 \
    https://github.com/ai/nanoid
  nix run nixpkgs#bun "$bun3nix" postinstall >./npm_deps.nix

  rm -rf ./node_modules
  cp -Lr "$(nix-build --no-out-link ./npm_deps.nix)/lib/node_modules" ./node_modules
  chmod -R u+rwX ./node_modules

  echo '
        import { strictEqual } from "node:assert";
        import isEven from "is-even";
        import _ from "lodash";
        import { nanoid } from "nanoid";
        strictEqual(_.filter([1, 2, 3], isEven).at(0), 2);
        strictEqual(nanoid().length, 21);
    ' >./test.ts
  # use nodejs instead of bun because bun sometimes automatically download dependencies
  # even without package.json, bun.lock, or node_modules
  nix run nixpkgs#nodejs ./test.ts
  nix run nixpkgs#typescript -- --noEmit ./test.ts

  cp ./npm_deps.nix ./npm_deps_formatted.nix
  nix run nixpkgs#nixfmt -- --strict ./npm_deps_formatted.nix
  diff -u --color=always ./npm_deps.nix ./npm_deps_formatted.nix
)

(
  echo "# postinstall: success with non-default package names"
  setup_test

  nix run nixpkgs#bun install \
    is-even@1.0.0 \
    @types/bun@1.2.21 \
    lorem@github:lodash/lodash#8a26eb4 \
    ipsum@https://github.com/ai/nanoid
  nix run nixpkgs#bun "$bun3nix" postinstall >./npm_deps.nix

  rm -rf ./node_modules
  cp -Lr "$(nix-build --no-out-link ./npm_deps.nix)/lib/node_modules" ./node_modules
  chmod -R u+rwX ./node_modules

  echo '
        import { strictEqual } from "node:assert";
        import isEven from "is-even";
        import _ from "lorem";
        import { nanoid } from "ipsum";
        strictEqual(_.filter([1, 2, 3], isEven).at(0), 2);
        strictEqual(nanoid().length, 21);
    ' >./test.ts
  # use nodejs instead of bun because bun sometimes automatically download dependencies
  # even without package.json, bun.lock, or node_modules
  nix run nixpkgs#nodejs ./test.ts
  nix run nixpkgs#typescript -- --noEmit ./test.ts

  cp ./npm_deps.nix ./npm_deps_formatted.nix
  nix run nixpkgs#nixfmt -- --strict ./npm_deps_formatted.nix
  diff -u --color=always ./npm_deps.nix ./npm_deps_formatted.nix
)

(
  echo "# install: success"
  setup_test

  nix run nixpkgs#bun "$bun3nix" install \
    is-even@1.0.0 \
    @types/bun@1.2.21 \
    github:lodash/lodash#8a26eb4 \
    https://github.com/ai/nanoid \
    >./npm_deps.nix
  for path in ./node_modules ./package.json ./bun.lock ./bun.lockb; do
    if [ -e "$path" ]; then
      echo "$path should not exist"
      exit 1
    fi
  done
  cp -Lr "$(nix-build --no-out-link ./npm_deps.nix)/lib/node_modules" ./node_modules
  chmod -R u+rwX ./node_modules

  echo '
        import { strictEqual } from "node:assert";
        import isEven from "is-even";
        import _ from "lodash";
        import { nanoid } from "nanoid";
        strictEqual(_.filter([1, 2, 3], isEven).at(0), 2);
        strictEqual(nanoid().length, 21);
    ' >./test.ts
  nix run nixpkgs#nodejs ./test.ts
  nix run nixpkgs#typescript -- --noEmit ./test.ts

  cp ./npm_deps.nix ./npm_deps_formatted.nix
  nix run nixpkgs#nixfmt -- --strict ./npm_deps_formatted
  diff -u --color=always ./npm_deps.nix ./npm_deps_formatted.nix
)

(
  echo "# install: success with non-default package names"
  setup_test

  nix run nixpkgs#bun "$bun3nix" install \
    is-even@1.0.0 \
    @types/bun@1.2.21 \
    lorem@github:lodash/lodash#8a26eb4 \
    ipsum@https://github.com/ai/nanoid \
    >./npm_deps.nix
  for path in ./node_modules ./package.json ./bun.lock ./bun.lockb; do
    if [ -e "$path" ]; then
      echo "$path should not exist"
      exit 1
    fi
  done
  cp -Lr "$(nix-build --no-out-link ./npm_deps.nix)/lib/node_modules" ./node_modules
  chmod -R u+rwX ./node_modules

  echo '
        import { strictEqual } from "node:assert";
        import isEven from "is-even";
        import _ from "lorem";
        import { nanoid } from "ipsum";
        strictEqual(_.filter([1, 2, 3], isEven).at(0), 2);
        strictEqual(nanoid().length, 21);
    ' >./test.ts
  nix run nixpkgs#nodejs ./test.ts
  nix run nixpkgs#typescript -- --noEmit ./test.ts

  cp ./npm_deps.nix ./npm_deps_formatted.nix
  nix run nixpkgs#nixfmt -- --strict ./npm_deps_formatted
  diff -u --color=always ./npm_deps.nix ./npm_deps_formatted.nix
)

(
  echo "# install: tailwindcss with plugins"
  setup_test

  nix run nixpkgs#bun "$bun3nix" install \
    @iconify/json@2.2.359 \
    @iconify/tailwind4@1.0.6 \
    daisyui@5.0.46 \
    @tailwindcss/cli@4.1.11 \
    tailwindcss@4.1.11 \
    >./npm_deps.nix
  deps=$(nix-build --no-out-link ./npm_deps.nix)

  echo '@import "tailwindcss"; @plugin "@iconify/tailwind4"; @plugin "daisyui"; ' >./style.css
  echo 'button class="icon-[heroicons--rss-solid] btn btn-soft"></button>' >./index.html

  NODE_PATH="$deps/lib/node_modules" \
    "$deps/bin/tailwindcss" --input ./style.css --output ./output.css

  for text in "\.btn" "\.btn-soft" "heroicons--rss-solid"; do
    if ! grep -q "$text" ./output.css; then
      echo "text not found: $text"
      exit 1
    fi
  done

  cp ./npm_deps.nix ./npm_deps_formatted.nix
  nix run nixpkgs#nixfmt -- --strict ./npm_deps_formatted
  diff -u --color=always ./npm_deps.nix ./npm_deps_formatted.nix

)

(
  echo "# install: tailwindcss with plugins (separate cli)"
  setup_test

  nix run nixpkgs#bun "$bun3nix" install \
    @iconify/json@2.2.359 \
    @iconify/tailwind4@1.0.6 \
    daisyui@5.0.46 \
    tailwindcss@4.1.11 \
    >./plugin_deps.nix
  plugin_deps=$(nix-build --no-out-link ./plugin_deps.nix)

  nix run nixpkgs#bun "$bun3nix" install @tailwindcss/cli@4.1.11 >./cli_deps.nix
  cli_deps=$(nix-build --no-out-link ./cli_deps.nix)

  echo '@import "tailwindcss"; @plugin "@iconify/tailwind4"; @plugin "daisyui";' >./style.css
  echo 'button class="icon-[heroicons--rss-solid] btn btn-soft"></button>' >./index.html

  NODE_PATH="$plugin_deps/lib/node_modules" \
    "$cli_deps/bin/tailwindcss" --input ./style.css --output ./output.css

  for text in "\.btn" "\.btn-soft" "heroicons--rss-solid"; do
    if ! grep -q "$text" ./output.css; then
      echo "text not found: $text"
      exit 1
    fi
  done

  cp ./plugin_deps.nix ./plugin_deps_formatted.nix
  nix run nixpkgs#nixfmt -- --strict ./plugin_deps_formatted
  diff -u --color=always ./plugin_deps.nix ./plugin_deps_formatted.nix

  cp ./cli_deps.nix ./cli_deps_formatted.nix
  nix run nixpkgs#nixfmt -- --strict ./cli_deps_formatted
  diff -u --color=always ./cli_deps.nix ./cli_deps_formatted.nix
)
