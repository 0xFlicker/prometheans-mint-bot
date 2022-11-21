import * as dotenv from "dotenv";

import { HardhatUserConfig, task, types } from "hardhat/config";
import "hardhat-deploy";
import "@nomiclabs/hardhat-etherscan";
import "@nomiclabs/hardhat-waffle";
import "@nomiclabs/hardhat-ethers";
import "@typechain/hardhat";
import "hardhat-gas-reporter";
import "solidity-coverage";
import { node_url, accounts, addForkConfiguration } from "./src/network";
import { utils } from "ethers";

dotenv.config();

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.16",
    settings: {
      optimizer: {
        enabled: true,
        runs: 10000,
      },
    },
  },
  defaultNetwork: "hardhat",
  namedAccounts: {
    deployer: 0,
  },
  networks: addForkConfiguration({
    hardhat: {
      initialBaseFeePerGas: 0, // to fix : https://github.com/sc-forks/solidity-coverage/issues/652, see https://github.com/sc-forks/solidity-coverage/issues/652#issuecomment-896330136
      accounts: accounts("hardhat"),
      tags: ["local"],
      forking: {
        enabled: true,
        url: node_url("mainnet"),
      },
    },
    sepolia: {
      url: node_url("sepolia"),
      accounts: accounts("sepolia"),
      deploy: ["deploy/testnet/"],
    },
    mainnet: {
      url: node_url("mainnet"),
      accounts: accounts("mainnet"),
      gasPrice: utils.parseUnits("9", "gwei").toNumber(),
      deploy: ["deploy/mainnet/"],
    },
  }),
  gasReporter: {
    enabled: process.env.REPORT_GAS !== undefined,
    gasPrice: 8,
    currency: "USD",
    coinmarketcap: process.env.COINMARKETCAP_API_KEY,
  },
  etherscan: {
    apiKey: {
      mainnet: process.env.ETHERSCAN_API_KEY_MAINNET || "",
      goerli: process.env.ETHERSCAN_API_KEY_GOERLI || "",
      sepolia: process.env.ETHERSCAN_API_KEY_SEPOLIA || "",
    },
  },
  typechain: {
    outDir: "src/contracts",
    target: "ethers-v5",
  },
};

export default config;
