module.exports = {
  skipFiles: [
    "Migrations.sol",
    "ERC721Patronage_v0.sol",
    "interfaces/IERC20Mintable.sol",
    "WildcardSteward_v0.sol",
    "WildcardSteward_v1.sol",
    "WildcardSteward_v2.sol",
    "patches_and_utilities/URIFixer.sol",
    "tests/SendBlockAttacker.sol",
    "previousVersions/ERC721Patronage_v0.sol",
    "previousVersions/WildcardSteward_v0.sol",
    "previousVersions/WildcardSteward_v1.sol",
    "previousVersions/WildcardSteward_v2.sol",
  ],
  providerOptions: {
    default_balance_ether: 3000,
  },
  mocha: {
    grep: "@skip-on-coverage", // Find everything with this tag
    invert: true, // Run the grep's inverse set.
    reporter: "spec",
  },
};
