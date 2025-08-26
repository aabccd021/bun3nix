{
  nixConfig.allow-import-from-derivation = false;

  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
  inputs.treefmt-nix.url = "github:numtide/treefmt-nix";

  outputs =
    { self, ... }@inputs:
    let
      lib = inputs.nixpkgs.lib;

      pkgs = inputs.nixpkgs.legacyPackages.x86_64-linux;

      treefmtEval = inputs.treefmt-nix.lib.evalModule pkgs {
        programs.nixfmt.enable = true;
        programs.biome.enable = true;
        programs.biome.formatUnsafe = true;
        programs.biome.settings.formatter.indentStyle = "space";
        programs.biome.settings.formatter.lineWidth = 100;
      };

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
