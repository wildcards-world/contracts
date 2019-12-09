module.exports = {
  skipFiles: ['ERC721Patronage_v0.sol', 'IERC721Patronage.sol', 'interfaces/IERC721Receiver.sol'],
  providerOptions: { default_balance_ether: 1000 },
  mocha: {
    grep: "@skip-on-coverage", // Find everything with this tag
    invert: true,              // Run the grep's inverse set.
    reporter: 'spec'
  }
};



