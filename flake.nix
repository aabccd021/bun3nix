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

      packages.formatting = treefmtEval.config.build.check self;

      packages.default = pkgs.writeShellApplication {
        name = "bun2node_modules";
        text = ''
          exec bun run ${./index.js} "$@";
        '';
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
          bun install @types/bun@1.2.21
          ${packages.default}/bin/bun2node_modules > ./node_modules.nix
          diff --unified --color ${./test_node_modules.nix} ./node_modules.nix
        '';
      };

      packages.test_node_modules = import ./test_node_modules.nix { inherit pkgs; };

      packages.test-run = pkgs.runCommand "test-run" { } ''
        cp -Lr ${packages.test_node_modules} ./node_modules
        cp -Lr ${./test.ts} ./test.ts
        ${pkgs.bun}/bin/bun ./test.ts
        ${pkgs.typescript}/bin/tsc --noEmit ./test.ts
        touch "$out"
      '';

    in

    {

      packages.x86_64-linux = packages;

      checks.x86_64-linux = packages;

      formatter.x86_64-linux = treefmtEval.config.build.wrapper;

    };
}
