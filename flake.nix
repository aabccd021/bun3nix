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

      packages.node_modules = import ./node_modules.nix { inherit pkgs; };

      packages.formatting = treefmtEval.config.build.check self;

      packages.bundleJs = pkgs.runCommand "bundle-js" { } ''
        mkdir "$out"
        ln -s ${packages.node_modules} ./node_modules
        cp -Lr ${./bun2nix.js} ./bun2nix.js
        ${pkgs.bun}/bin/bun build ./bun2nix.js --target=bun --minify --outfile "$out/bun2nix.js"
      '';

      packages.default = pkgs.writeShellApplication {
        name = "bun2nix";
        text = ''
          exec bun run ${packages.bundleJs}/bun2nix.js "$@";
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
          bun install @types/bun
          ${packages.default}/bin/bun2nix > ./node_modules.nix
          diff --unified --color ${./test/node_modules.nix} ./node_modules.nix
        '';
      };

      packages.test_node_modules = import ./test/node_modules.nix { inherit pkgs; };

      packages.test-run = pkgs.runCommand "test-run" { } ''
        cp -Lr ${packages.test_node_modules} ./node_modules
        cp -Lr ${./test/index.ts} ./index.ts
        ${pkgs.bun}/bin/bun ./index.ts
        ${pkgs.typescript}/bin/tsc --noEmit ./index.ts
        touch "$out"
      '';

    in

    {

      packages.x86_64-linux = packages;

      checks.x86_64-linux = packages;

      formatter.x86_64-linux = treefmtEval.config.build.wrapper;

    };
}
