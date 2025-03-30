const networks = {
  coverage: {
    url: "http://127.0.0.1:8555",
    // blockGasLimit: 200000000,
    allowUnlimitedContractSize: true,
  },

  rinkeby: {
    url: "https://rinkeby.infura.io/v3/b7a2979d9ef740ab8124922f2b326a60",
    blockGasLimit: 200000000,
    allowUnlimitedContractSize: true,
    accounts: [
      "0xce9f7be01bacde7ea1bdd3e334daf53a4de663c00cf1891785bc271f06b82ed0",
    ],
  },

  ropsten: {
    url: "https://ropsten.infura.io/v3/a3564d02d1bc4df58b7079a06b59a1cc",
    blockGasLimit: 200000000,
    allowUnlimitedContractSize: true,
    accounts: [
      "0x2aeac2838831304122454658c1a0bc64278d0d4ccef937e7004d192e085739a6",
    ],
  },

  hecoTest: {
    url: "https://http-testnet.hecochain.com",
    blockGasLimit: 200000000,
    allowUnlimitedContractSize: true,
    chainId: 256,
    accounts: [
      `0xce9f7be01bacde7ea1bdd3e334daf53a4de663c00cf1891785bc271f06b82ed0`,
    ],
  },

  topTest1: {
    url: "http://192.168.50.167:8080",
    blockGasLimit: 200000000,
    allowUnlimitedContractSize: true,
    chainId: 1023,
    accounts: [
      `0x6537318dcecc07ecc3c0b99558f4a7b5d5a50b6c4d7fed8c75112919a473700a`,
    ],
  },

  topTest2: {
    url: "http://159.135.194.94:28080",
    // blockGasLimit: 200000000,
    gas: 3000000,
    allowUnlimitedContractSize: true,
    chainId: 1023,
    accounts: [
      `0x54639e47984fafe6355316dc381a616c838e6acf846869001868b809b6158f5f`,
      `0x4edf73c3fb18df03994640f1f0156103accc327bd4d8a8e497e969733e87e151`,
      `0x73cdcb64d2b8fc34c9778c34219a8a2bf95537c5854d0255f8712b3161901924`,
      `0x6537318dcecc07ecc3c0b99558f4a7b5d5a50b6c4d7fed8c75112919a473700a`,
    ],
  },

  hardhat: {
    forking: {
      url: "http://159.135.194.94:28080",
      enabled: true,
      // 添加回调函数
      forkingCallback: (forkingData) => {
        console.log("分叉状态:", forkingData);
      },
    },
    loggingEnabled: true,
    accounts: {
      mnemonic: "test test test test test test test test test test test junk",
    },
  },

  localhost: {
    // chainId: 1,
    url: "http://127.0.0.1:8545",
    // url: 'http://192.168.30.32:8545',
    allowUnlimitedContractSize: true,

    accounts: {
      mnemonic: "test test test test test test test test test test test junk",
    },
    timeout: 1000 * 60,
    hardfork: "istanbul",
    forking: {
      blockNumber: 0,
    },
  },
};

if (process.env.ALCHEMY_URL && process.env.FORK_ENABLED) {
  networks.hardhat = {
    allowUnlimitedContractSize: true,
    chainId: 1,
    forking: {
      url: process.env.ALCHEMY_URL,
    },
    accounts: {
      mnemonic: "test test test test test test test test test test test junk",
    },
    hardfork: "london",
    gasPrice: "auto",
  };
  if (process.env.FORK_BLOCK_NUMBER) {
    networks.hardhat.forking.blockNumber = parseInt(
      process.env.FORK_BLOCK_NUMBER
    );
  }
} else {
  networks.hardhat = {
    allowUnlimitedContractSize: true,
    accounts: {
      mnemonic: "test test test test test test test test test test test junk",
    },
  };
}

if ("test test test test test test test test test test test junk") {
  networks.bsc = {
    chainId: 56,
    url: "https://bsc-dataseed.binance.org",
    accounts: {
      mnemonic: "test test test test test test test test test test test junk",
    },
  };
  networks.bscTestnet = {
    chainId: 97,
    url: "https://data-seed-prebsc-1-s1.binance.org:8545/",
    accounts: {
      mnemonic: "test test test test test test test test test test test junk",
    },
  };
  networks.heco = {
    chainId: 128,
    url: "https://http-mainnet-node.huobichain.com",
    accounts: {
      mnemonic: "test test test test test test test test test test test junk",
    },
  };
  networks.hecoTestnet = {
    chainId: 256,
    url: "https://http-testnet.hecochain.com",
    accounts: {
      mnemonic: "test test test test test test test test test test test junk",
    },
  };
}

if (
  process.env.INFURA_API_KEY &&
  "test test test test test test test test test test test junk"
) {
  networks.kovan = {
    url: `https://kovan.infura.io/v3/${process.env.INFURA_API_KEY}`,
    accounts: {
      mnemonic: "test test test test test test test test test test test junk",
    },
  };
  networks.rinkeby = {
    url: `https://rinkeby.infura.io/v3/${process.env.INFURA_API_KEY}`,
    accounts: {
      mnemonic: "test test test test test test test test test test test junk",
    },
  };
  networks.eth = {
    url: `https://mainnet.infura.io/v3/${process.env.INFURA_API_KEY}`,
    accounts: {
      mnemonic: "test test test test test test test test test test test junk",
    },
  };
} else {
  console.warn("No infura or hdwallet available for testnets");
}

module.exports = networks;
