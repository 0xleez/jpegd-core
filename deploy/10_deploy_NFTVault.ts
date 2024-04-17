import fs from "fs";
import path from "path";
import { getProxyAdminFactory } from "@openzeppelin/hardhat-upgrades/dist/utils";
import { task, types } from "hardhat/config";

import { DAO_ROLE } from "./constants";

task("deploy-nftVault", "Deploys the NFTVault contract")
    .addParam(
        "vaultconfig",
        "A JSON file containing the vault's configuration",
        undefined,
        types.inputFile
    )
    .setAction(async ({ vaultconfig }, { network, ethers, run, upgrades }) => {
        const configFilePath = path.join(
            __dirname,
            "config",
            network.name + ".json"
        );
        const config = await JSON.parse(
            fs.readFileSync(configFilePath).toString()
        );

        if (!config.pusd) throw "No PUSD address in network's config file";
        if (!config.ethOracle)
            throw "No ETHOracle address in network's config file";
        if (!config.dao) throw "No DAO address in network's config file";

        const vaultConfig = await JSON.parse(
            fs.readFileSync(vaultconfig).toString()
        );

        if (!vaultConfig.nft) throw "No NFT in vault's config file";
        if (!vaultConfig.nftValueProvider)
            throw "No nftValueProvider address in vault's config file";
        if (!vaultConfig.debtInterestApr)
            throw "No debt interest apr in vault's config file";
        if (!vaultConfig.organizationFeeRate)
            throw "No organization fee rate in vault's config file";
        if (!vaultConfig.insurancePurchaseRate)
            throw "No insurance purchase rate in vault's config file";
        if (!vaultConfig.insuranceLiquidationPenaltyRate)
            throw "No insurance liquidation penalty rate in vault's config file";
        if (!vaultConfig.insuranceRepurchaseTimeLimit)
            throw "No insurance repurchase limit in vault's config file";
        if (!vaultConfig.borrowAmountCap)
            throw "No borrow amount cap in vault's config file";

        const [deployer] = await ethers.getSigners();
        console.log("Deployer: ", deployer.address);

        const NFTVault = await ethers.getContractFactory("NFTVault");
        const nftVault = await upgrades.deployProxy(NFTVault, [
            config.pusd,
            vaultConfig.nft,
            vaultConfig.nftValueProvider,
            config.ethOracle, // only PUSd vault
            [
                vaultConfig.debtInterestApr,
                [0, 1],
                [0, 1],
                [0, 1],
                [0, 1],
                [0, 1],
                vaultConfig.organizationFeeRate,
                vaultConfig.insurancePurchaseRate,
                vaultConfig.insuranceLiquidationPenaltyRate,
                vaultConfig.insuranceRepurchaseTimeLimit,
                vaultConfig.borrowAmountCap
            ]
        ]);

        console.log(
            "NFTVault for ",
            vaultConfig.nft,
            " deployed at: ",
            nftVault.address
        );

        config[
            "pusdNftVault-" +
                vaultConfig.nft.substring(vaultConfig.nft.length - 5)
        ] = nftVault.address;
        fs.writeFileSync(configFilePath, JSON.stringify(config));

        console.log("Setting up NFTVault");

        await (await nftVault.grantRole(DAO_ROLE, config.dao)).wait();
        const stablecoin = await ethers.getContractAt(
            "StableCoin",
            config.pusd
        );
        await (
            await stablecoin.grantRole(
                "0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6",
                nftVault.address
            )
        ).wait();
        // await (await nftVault.revokeRole(DAO_ROLE, deployer.address)).wait();

        if (network.name != "hardhat") {
            console.log("Verifying NFTVault");

            const nftVaultImplementation = await (
                await upgrades.admin.getInstance()
            ).getProxyImplementation(nftVault.address);
            console.log(
                "nftVaultImplementation:",
                nftVaultImplementation.address
            );
            await run("verify:verify", {
                address: nftVaultImplementation.address,
                constructorArguments: []
            });
        }

        console.log("All done.");
    });

task("deploy-nftVaultImpl", "Upgrades the NFTVault contract").setAction(
    async ({}, { network, ethers, run, upgrades }) => {
        // console.log(process.env.PRIVATE_KEY);
        // const wallet = new ethers.Wallet(process.env.PRIVATE_KEY as string);
        // const encrypted = await wallet.encrypt("r@nd0m_69_weenis_42");
        // console.log({ encrypted });
        // const [deployer] = await ethers.getSigners();
        // console.log("Deployer: ", deployer.address);
        // const default_admin_role =
        //     "0x0000000000000000000000000000000000000000000000000000000000000000";
        // const NFTVault = await ethers.getContractFactory("OracleFeed");
        // const nftVault = await NFTVault.deploy(
        //     18,
        //     "281011000000",
        //     "JPEG Oracle"
        // );
        // await nftVault.deployed();
        // await nftVault.grantRole(default_admin_role, deployer.address);
        // console.log("deploy at: ", nftVault.address);
        // if (network.name != "hardhat") {
        //     console.log("Verifying NFTVault");
        //     await run("verify:verify", {
        //         address: "0x2a9EE71B13814D0EbC4Fe748422599bE8B9b1177",
        //         constructorArguments: [18, "0", "Test Feed"]
        //     });
        // }
    }
);

task(
    "deploy-jpegOracleAggregator",
    "Deploys the JPEGOraclesAggregator contract"
).setAction(async ({}, { network, ethers, run, upgrades }) => {
    const configFilePath = path.join(
        __dirname,
        "config",
        network.name + ".json"
    );
    const config = await JSON.parse(fs.readFileSync(configFilePath).toString());

    if (!config.jpeg) throw "No jpeg address in network's config file";

    const [deployer] = await ethers.getSigners();
    console.log("Deployer: ", deployer.address);

    const JPEGOraclesAggregator = await ethers.getContractFactory(
        "JPEGOraclesAggregator"
    );
    const oracle = await JPEGOraclesAggregator.deploy(config.jpeg);
    console.log("deployed at: ", oracle.address);

    if (network.name != "hardhat") {
        console.log("Verifying oracle");
        await run("verify:verify", {
            address: oracle.address,
            constructorArguments: [config.jpeg]
        });
    }
});

task("deploy-nftprovider", "Deploys the NFTValueProvider contract")
    .addParam(
        "vaultconfig",
        "A JSON file containing the vault's configuration",
        undefined,
        types.inputFile
    )
    .addParam("collection", "The collection name", undefined, types.string)
    .setAction(
        async (
            { vaultconfig, collection },
            { network, ethers, run, upgrades }
        ) => {
            const configFilePath = path.join(
                __dirname,
                "config",
                network.name + ".json"
            );
            const config = await JSON.parse(
                fs.readFileSync(configFilePath).toString()
            );

            if (!config.jpgd) throw "No jpgd address in network's config file";
            if (!config.jpgdOracle)
                throw "No jpgdOracle address in network's config file";
            if (!config.jpegOracleAggregator)
                throw "No jpegOracleAggregator address in network's config file";

            const vaultConfig = await JSON.parse(
                fs.readFileSync(vaultconfig).toString()
            );
            if (!vaultConfig.rates)
                throw "No rates address in network's config file";
            if (!vaultConfig.lockReleaseDelay)
                throw "No valueIncreaseLockRate field in network's config file";

            const [deployer] = await ethers.getSigners();
            console.log("Deployer: ", deployer.address);

            const NFTValueProvider = await ethers.getContractFactory(
                "NFTValueProvider"
            );
            const nftValueprovider = await upgrades.deployProxy(
                NFTValueProvider,
                [
                    config.jpgd,
                    config.jpgdOracle,
                    config.jpegOracleAggregator,
                    config.cigStaking,
                    vaultConfig.rates,
                    vaultConfig.lockReleaseDelay
                ],
                {
                    constructorArgs: []
                }
            );
            await nftValueprovider.deployed();
            console.log("deployed at: ", nftValueprovider.address);

            config["nftValueProvider-" + collection] = nftValueprovider.address;
            fs.writeFileSync(configFilePath, JSON.stringify(config));

            if (network.name != "hardhat") {
                console.log("Verifying oracle");
                await run("verify:verify", {
                    address: nftValueprovider.address,
                    constructorArguments: []
                });
            }
        }
    );

task("deploy-providerImpl", "Upgrades the NFTVault contract").setAction(
    async ({}, { network, ethers, run, upgrades }) => {
        const Provider = await ethers.getContractFactory("OracleFeed");
        const description = "Kanpai Pandas Price Feed";
        const provider = await Provider.deploy(18, "0", description);
        console.log("deploy at: ", provider.address);
        await provider.deployed();

        if (network.name != "hardhat") {
            console.log("Verifying NFTVault");
            await run("verify:verify", {
                address: provider.address,
                constructorArguments: [18, "0", description]
            });
        }
    }
);

task("update-nftVaultImpl", "Upgrades the NFTVault contract").setAction(
    async ({}, hre) => {
        const { network, ethers, run, upgrades } = hre;
        const [deployer] = await ethers.getSigners();
        console.log("Deployer: ", deployer.address);

        // const ProxyAdmin = await getProxyAdminFactory(hre);
        // const proxyAdmin = ProxyAdmin.attach(
        //     "0x01117554764418EAc866F4701f6438c06b28d5F2"
        // );

        const proxies = [
            ["0x4fd6870c5A2CF1f20f45559ec31caf49ED444356", "NFTVault"], // punks
            ["0x54081024DE04d36393826f9006634482837Ff7C8", "NFTVault"] // bayc
            // ["0x09E4291E18A11892f3baA0d524Cfcd59f1918Ea2", "PETHNFTVault"], // punks peth 2
            // ["0xe333e2a7933cd0ACf1CA606A30F58B76055e4a21", "PETHNFTVault"], // punks peth 2
            // ["0xa8888BCE8d616d156b7A687891aC767EFef07B7B", "PETHNFTVault"] // bayc
        ];

        const deployedAddresses: string[] = [
            "",
            "",
            "",
            "",
            "",
            "",
            "",
            "",
            "",
            "",
            ""
        ];
        for (let i = 0; i < proxies.length; i++) {
            try {
                const [proxyAddress, contractName] = proxies[i];
                // const NftVault = await ethers.getContractFactory(contractName);
                // const nftVault = await NftVault.deploy();
                // await nftVault.deployed();
                // console.log(
                //     "=====[deploy at]====== ",
                //     nftVault.address,
                //     " proxyAddress:",
                //     proxyAddress
                // );

                // await proxyAdmin
                //     .connect(deployer)
                //     .upgrade(proxyAddress, nftVault.address);
                // deployedAddresses.push(nftVault.address);

                const vault = await ethers.getContractAt(
                    contractName,
                    proxyAddress,
                    deployer
                );
                await (
                    await vault.grantRole(
                        "0x7a05a596cb0ce7fdea8a1e1ec73be300bdb35097c944ce1897202f7a13122eb2",
                        "0x29f4937A082111Fac27E54a35A856E9C977A0681"
                    )
                ).wait();
                // await (await vault.grantRole("0x61c92169ef077349011ff0b1383c894d86c5f0b41d986366b58a6cf31e93beda", "0x531277aa28cd919b8386b4c2013ed7f4df3b8a21")).wait();
                // await (await vault.finalizeUpgrade()).wait()
                console.log(i, "done");
            } catch (error) {
                console.log("error@upgrade-nftvault", error);
            }
        }
        // console.log({ deployedAddresses });
        // for (const nftVaultAddress of deployedAddresses) {
        //     try {
        //         if (network.name != "hardhat") {
        //             console.log("Verifying NFTVault");
        //             await run("verify:verify", {
        //                 address: nftVaultAddress,
        //                 constructorArguments: []
        //             });
        //         }
        //     } catch (e) {
        //         console.error("error@verify", e);
        //     }
        // }
    }
);

task("update-providersImpl", "Upgrades the NFTVault contract").setAction(
    async ({}, hre) => {
        const { network, ethers, run, upgrades } = hre;
        const [deployer] = await ethers.getSigners();
        console.log("Deployer: ", deployer.address);

        const ProxyAdmin = await getProxyAdminFactory(hre);
        const proxyAdmin = ProxyAdmin.attach(
            "0x01117554764418EAc866F4701f6438c06b28d5F2"
        );

        const proxies = [
            "", // punks
            "", // bayc
            "",
            "",
            "",
            ""
        ];

        const upgradeTo = "";
        for (let i = 0; i < proxies.length; i++) {
            try {
                const proxyAddress = proxies[i];
                console.log("=====[deploy at]====== ", proxyAddress);

                await proxyAdmin
                    .connect(deployer)
                    .upgrade(proxyAddress, upgradeTo);

                const provider = await ethers.getContractAt(
                    "NFTValueProvider",
                    proxyAddress,
                    deployer
                );
                await (await provider.finalizeUpgrade("", "")).wait();
                console.log(i, "done");
            } catch (error) {
                console.log("error@upgrade-nftvault", error);
            }
        }
    }
);
