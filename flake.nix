{
  nixConfig.allow-import-from-derivation = false;

  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
  inputs.treefmt-nix.url = "github:numtide/treefmt-nix";

  outputs =
    { self, ... }@inputs:
    let
      pkgs = inputs.nixpkgs.legacyPackages.x86_64-linux;

      treefmtEval = inputs.treefmt-nix.lib.evalModule pkgs {
        programs.nixfmt.enable = true;
        programs.biome.enable = true;
        programs.biome.formatUnsafe = true;
        programs.biome.settings.formatter.indentStyle = "space";
        programs.biome.settings.formatter.lineWidth = 100;
      };

      packages.test-generate = pkgs.writeShellApplication {
        name = "test-generate";
        runtimeInputs = [ pkgs.bun ];
        text = ''
          tmpdir=$(mktemp -d)
          trap 'rm -rf $tmpdir' EXIT
          cd "$tmpdir" || exit 1
          bun install is-even@1.0.0
          bun install lodash@github:lodash/lodash#8a26eb4
          bun run ${packages.bundle}/bun2nix.js > ./node_modules.nix
          diff --unified --color ${./test/node_modules.nix} ./node_modules.nix
        '';
      };

      test_node_modules = import ./test/node_modules.nix { inherit pkgs; };

      packages.test-run = pkgs.runCommand "test-run" { } ''
        cp -Lr ${test_node_modules} ./node_modules
        cp -Lr ${./test/index.ts} ./index.ts
        ${pkgs.bun}/bin/bun ./index.ts
        ${pkgs.typescript}/bin/tsc --noEmit ./index.ts
        touch "$out"
      '';

      node_modules = import ./node_modules.nix { inherit pkgs; };

      packages.formatting = treefmtEval.config.build.check self;

      packages.bundle = pkgs.runCommand "bun2nix.js" { } ''
        mkdir "$out"
        ln -s ${node_modules} ./node_modules
        cp -Lr ${./bun2nix.js} ./bun2nix.js
        ${pkgs.bun}/bin/bun build ./bun2nix.js \
          --target=bun --minify --sourcemap=inline --outfile "$out/bun2nix.js"
      '';

    in

    {

      packages.x86_64-linux = packages;

      checks.x86_64-linux = packages;

      formatter.x86_64-linux = treefmtEval.config.build.wrapper;

    };
}
