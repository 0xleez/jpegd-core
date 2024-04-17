import dotenv from "dotenv";
import "@nomicfoundation/hardhat-verify";
import "@nomicfoundation/hardhat-chai-matchers";
import "@nomiclabs/hardhat-ethers";
import "@typechain/hardhat";
import "@openzeppelin/hardhat-upgrades";
import "hardhat-gas-reporter";
import "solidity-coverage";
import "hardhat-abi-exporter";

import "./deploy/1_deploy_JPEG";
import "./deploy/2_deploy_TokenSale";
import "./deploy/3_deploy_JPEGStaking";
import "./deploy/4_deploy_PreJPEG";
import "./deploy/5_deploy_Stablecoin";
import "./deploy/6_deploy_JPEGLock";
import "./deploy/7_deploy_CryptoPunksHelper";
import "./deploy/8_deploy_EtherRocksHelper";
import "./deploy/9_deploy_JPEGCardsCigStaking";
import "./deploy/10_deploy_NFTVault";
import "./deploy/11_configure_CryptoPunksHelper";
import "./deploy/12_configure_EtherRocksHelper";
import "./deploy/13_deploy_FungibleAssetVaultForDAO";
import "./deploy/14_deploy_JPEGDLPFarming";
import "./deploy/15_transferOwnership";
import "./deploy/16_deploy_Vault";
import "./deploy/17_deploy_StrategyPUSDConvex";
import "./deploy/18_deploy_ApeStake";

dotenv.config();

module.exports = {
    defaultNetwork: "hardhat",
    gasReporter: {
        showTimeSpent: true,
        currency: "USD"
    },
    networks: {
        hardhat: {
            forking: {
                url:
                    "https://eth-mainnet.alchemyapi.io/v2/" +
                    process.env.ALCHEMY_API_KEY,
                blockNumber: 16097722
            }
        },
        goerli: {
            url:
                "https://eth-goerli.alchemyapi.io/v2/" +
                process.env.ALCHEMY_API_KEY,
            accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : []
        },
        arbitrumSepolia: {
            url:
                // "https://arb-sepolia.g.alchemyapi.io/v2/" + process.env.ALCHEMY_API_KEY
                "https://sepolia-rollup.arbitrum.io/rpc",
            accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : []
        },
        mainnet: {
            url:
                "https://eth-mainnet.alchemyapi.io/v2/" +
                process.env.ALCHEMY_API_KEY,
            accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : []
        }
    },
    solidity: {
        compilers: [
            {
                version: "0.8.4",
                settings: {
                    optimizer: {
                        enabled: true,
                        runs: 300
                    }
                }
            },
            {
                version: "0.8.8",
                settings: {
                    optimizer: {
                        enabled: true,
                        runs: 300
                    }
                }
            },
            {
                version: "0.8.9",
                settings: {
                    optimizer: {
                        enabled: true,
                        runs: 300
                    }
                }
            }
        ]
    },
    paths: {
        sources: "./contracts",
        tests: "./tests",
        cache: "./cache",
        artifacts: "./artifacts"
    },
    mocha: {
        timeout: 200000
    },
    etherscan: {
        apiKey: {
            mainnet: process.env.ETHERSCAN_API_KEY,
            goerli: process.env.ETHERSCAN_API_KEY,
            arbitrumSepolia: process.env.ARBISCAN_API_KEY
        },
        customChains: [
            {
                network: "arbitrumSepolia",
                chainId: 421614,
                urls: {
                    apiURL: "https://api-sepolia.arbiscan.io/api",
                    browserURL: "https://sepolia.arbiscan.io/"
                }
            }
        ]
    },
    sourcify: {
        enabled: false,
        // Optional: specify a different Sourcify server
        apiUrl: "https://sourcify.dev/server",
        // Optional: specify a different Sourcify repository
        browserUrl: "https://repo.sourcify.dev"
    },
    abiExporter: {
        path: "./abi",
        clear: true,
        flat: true,
        spacing: 2
    },
    typechain: {
        outDir: "types",
        target: "ethers-v5"
    }
};
