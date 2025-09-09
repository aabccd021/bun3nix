{

  inputs.nixpkgs.url = "github:nixos/nixpkgs/nixos-unstable";
  inputs.treefmt-nix.url = "github:numtide/treefmt-nix";

  outputs =
    { self, ... }@inputs:
    let

      forAllSystems =
        function:
        inputs.nixpkgs.lib.genAttrs [
          "x86_64-linux"
          "aarch64-linux"
          "x86_64-darwin"
          "aarch64-darwin"
        ] (system: function inputs.nixpkgs.legacyPackages.${system});

      treefmtEval =
        pkgs:
        inputs.treefmt-nix.lib.evalModule pkgs {
          programs.nixfmt.enable = true;
          programs.prettier.enable = true;
          programs.prettier.includes = [
            "*.md"
            "*.yml"
          ];
          programs.biome.enable = true;
          programs.biome.formatUnsafe = true;
          programs.biome.settings.formatter.indentStyle = "space";
          programs.biome.settings.formatter.lineWidth = 100;
          programs.biome.settings.linter.rules.suspicious.noConsole = "error";
          programs.shfmt.enable = true;
          programs.shellcheck.enable = true;
          settings.formatter.shellcheck.options = [
            "-s"
            "sh"
          ];
        };

    in
    {
      packages = forAllSystems (pkgs: {
        default = pkgs.writeShellScriptBin "bun3nix" ''
          exec ${pkgs.bun}/bin/bun ${./index.js} "$@"
        '';
      });
      checks = forAllSystems (pkgs: {
        formatting = (treefmtEval pkgs).config.build.check self;
      });
      formatter = forAllSystems (pkgs: (treefmtEval pkgs).config.build.wrapper);
    };
}
