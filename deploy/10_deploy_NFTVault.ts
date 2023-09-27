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
        if (!config.jpeg) throw "No JPEG address in network's config file";
        if (!config.ethOracle)
            throw "No ETHOracle address in network's config file";
        if (!config.cigStaking)
            throw "No JPEGCardsCigStaking address in network's config file";
        if (!config.dao) throw "No DAO address in network's config file";

        const vaultConfig = await JSON.parse(
            fs.readFileSync(vaultconfig).toString()
        );

        if (!vaultConfig.nft) throw "No NFT in vault's config file";
        if (!vaultConfig.floorOracle)
            throw "No floor oracle in vault's config file";
        if (!vaultConfig.debtInterestApr)
            throw "No debt interest apr in vault's config file";
        if (!vaultConfig.creditLimitRate)
            throw "No credit limit rate in vault's config file";
        if (!vaultConfig.liquidationLimitRate)
            throw "No liquidation limit rate in vault's config file";
        if (!vaultConfig.cigStakedCreditLimitRate)
            throw "No cig staked credit limit rate in vault's config file";
        if (!vaultConfig.cigStakedLiquidationLimitRate)
            throw "No cig staked liquidation limit rate in vault's config file";
        if (!vaultConfig.valueIncreaseLockRate)
            throw "No value increase lock rate in vault's config file";
        if (!vaultConfig.organizationFeeRate)
            throw "No organization fee rate in vault's config file";
        if (!vaultConfig.insurancePurchaseRate)
            throw "No insurance purchase rate in vault's config file";
        if (!vaultConfig.insuranceLiquidationPenaltyRate)
            throw "No insurance liquidation penalty rate in vault's config file";
        if (!vaultConfig.insuranceRepurchaseLimit)
            throw "No insurance repurchase limit in vault's config file";
        if (!vaultConfig.borrowAmountCap)
            throw "No borrow amount cap in vault's config file";

        const [deployer] = await ethers.getSigners();
        console.log("Deployer: ", deployer.address);

        const NFTVault = await ethers.getContractFactory("PETHNFTVault");
        const nftVault = await upgrades.deployProxy(NFTVault, [
            config.peth,
            vaultConfig.nft,
            vaultConfig.nftValueProvider,
            [
                vaultConfig.debtInterestApr,
                vaultConfig.creditLimitRate,
                vaultConfig.liquidationLimitRate,
                vaultConfig.cigStakedCreditLimitRate,
                vaultConfig.cigStakedLiquidationLimitRate,
                vaultConfig.valueIncreaseLockRate,
                vaultConfig.organizationFeeRate,
                vaultConfig.insurancePurchaseRate,
                vaultConfig.insuranceLiquidationPenaltyRate,
                vaultConfig.insuranceRepurchaseLimit,
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
            "pethNftVault-" +
                vaultConfig.nft.substring(vaultConfig.nft.length - 5)
        ] = nftVault.address;
        fs.writeFileSync(configFilePath, JSON.stringify(config));

        console.log("Setting up NFTVault");

        await (await nftVault.grantRole(DAO_ROLE, config.dao)).wait();
        // await (await nftVault.revokeRole(DAO_ROLE, deployer.address)).wait();

        if (network.name != "hardhat") {
            console.log("Verifying NFTVault");

            const nftVaultImplementation = await (
                await upgrades.admin.getInstance()
            ).getProxyImplementation(nftVault.address);

            await run("verify:verify", {
                address: nftVaultImplementation.address,
                constructorArguments: []
            });
        }

        console.log("All done.");
    });

task("deploy-nftVaultImpl", "Upgrades the NFTVault contract").setAction(
    async ({}, { network, ethers, run, upgrades }) => {
        const [deployer] = await ethers.getSigners();
        console.log("Deployer: ", deployer.address);

        const NFTVault = await ethers.getContractFactory("PETHNFTVault");
        const nftVault = await NFTVault.deploy();
        await nftVault.deployed();
        console.log("deploy at: ", nftVault.address);

        if (network.name != "hardhat") {
            console.log("Verifying NFTVault");
            await run("verify:verify", {
                address: nftVault.address,
                constructorArguments: []
            });
        }
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

            if (!config.jpeg) throw "No jpeg address in network's config file";

            const vaultConfig = await JSON.parse(
                fs.readFileSync(vaultconfig).toString()
            );
            if (!vaultConfig.jpegOraclesAggregator)
                throw "No jpegOraclesAggregator address in network's config file";
            if (!vaultConfig.valueIncreaseLockRate)
                throw "No valueIncreaseLockRate field in network's config file";

            const [deployer] = await ethers.getSigners();
            console.log("Deployer: ", deployer.address);

            const NFTValueProvider = await ethers.getContractFactory(
                "NFTValueProvider"
            );
            const nftValueprovider = await upgrades.deployProxy(
                NFTValueProvider,
                [
                    config.jpeg,
                    vaultConfig.jpegOraclesAggregator,
                    config.cigStaking,
                    vaultConfig.creditLimitRate,
                    vaultConfig.liquidationLimitRate,
                    vaultConfig.valueIncreaseLockRate,
                    vaultConfig.jpegLockedRateIncrease,
                    vaultConfig.traitBoostLockRate,
                    vaultConfig.ltvBoostLockRate,
                    "0"
                ]
            );
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
        const Provider = await ethers.getContractFactory("NFTValueProvider");
        const provider = await Provider.deploy();
        console.log("deploy at: ", provider.address);
        await provider.deployed();

        if (network.name != "hardhat") {
            console.log("Verifying NFTVault");
            await run("verify:verify", {
                address: provider.address,
                constructorArguments: []
            });
        }
    }
);

task("update-nftVaultImpl", "Upgrades the NFTVault contract").setAction(
    async ({}, hre) => {
        const { network, ethers, run, upgrades } = hre;
        const [deployer] = await ethers.getSigners();
        console.log("Deployer: ", deployer.address);

        const ProxyAdmin = await getProxyAdminFactory(hre);
        const proxyAdmin = ProxyAdmin.attach(
            "0x01117554764418EAc866F4701f6438c06b28d5F2"
        );

        const proxies = [
            ["0x33c52E377CF7D76a97b93C337cDd1a42c9dDE019", "NFTVault"],
            ["0x4D057e43316058F4Ae2199954f79dD19952a548B", "NFTVault"],
            ["0x26916b8F7f76cF2b5FeD919A97E66acdb83Fbe80", "NFTVault"],
            ["0x601666b790CE63c221266BcC4fecBB505DdC31cb", "NFTVault"],
            ["0x148266c9EB56D03D5B2425610C828144A4DeF702", "PETHNFTVault"],
            ["0x06Fe4b4b7646FD6E33bFd27245386E5E30e43F02", "PETHNFTVault"], // punks peth 2
            ["0xAF887649F859921614Fd018cFB32E27DA6547093", "PETHNFTVault"], // bayc peth
            ["0x3c1fE934a1918FDaAA7264B7AdF7eF2f905dd079", "PETHNFTVault"], // bayc peth 2
            ["0xCb17D8aC8A5Ef576CD73729b22779e55bc686f43", "PETHNFTVault"], // bayc peth 3
            ["0x4d3F17C4dBF559c38d6Dd49942788B6c83eB7a74", "PETHNFTVault"],
            ["0x1f25109d1BE568b70cc159bC97f131cD493D58ee", "PETHNFTVault"]
        ];

        const deployedAddresses: string[] = [
            "0x7F897e1229E3a32Be2B33122C099AF29C99B8aB4",
            "0xa50078695974EdD511a9103aB7FB8537D1d6556C",
            "0x3b37b6Efb33193de79b0818F38f64186E92E3E1E",
            "0x9465bf3c8cC049cD9Cdc9961BaC858093e829CBf",
            "0x26DFfD5F3A62BC4D827A2C330e110A6C35CCBcd5",
            "0x3A6C7E585C8B4Ae32b5EeB60C8620934f61fe397",
            "0x9B3e61a9F6AC2F1b776fffd7f667f2dc5BE25d2b",
            "0x2Af3C89f295FE40B7ac42fb24F29121513029bbE",
            "0xa69269741946Df348A6f3e9d847B9749FfcE3abD",
            "0x1ec60e07a33dF06688ef579C9b38f3c10a4f2Beb",
            "0xe3336310A03F962A92eA4b2A1F85B3875180A679"
        ];
        // for (let i = 0; i < proxies.length; i++) {
        // 	try {
        // 		const [proxyAddress, contractName] = proxies[i]
        // 		const NftVault = await ethers.getContractFactory(contractName);
        // 		const nftVault = await NftVault.deploy()
        // 		await nftVault.deployed()
        // 		console.log("=====[deploy at]====== ", nftVault.address, " proxyAddress:", proxyAddress)

        // 		await proxyAdmin.connect(deployer).upgrade(proxyAddress, nftVault.address);
        // 		deployedAddresses.push(nftVault.address)
        // 		// const vault = await ethers.getContractAt(contractName, proxyAddress, deployer);
        // 		// await (await vault.grantRole("0x61c92169ef077349011ff0b1383c894d86c5f0b41d986366b58a6cf31e93beda", "0x531277aa28cd919b8386b4c2013ed7f4df3b8a21")).wait();
        // 		// await (await vault.finalizeUpgrade()).wait()
        // 		// await (await vault.grantRole("0x7a05a596cb0ce7fdea8a1e1ec73be300bdb35097c944ce1897202f7a13122eb2", "0xF9423E5cc3eE0956e7cB43BC7fffA9EA4C293F4d")).wait();
        // 		console.log(i, "done")
        // 	} catch(error) {
        // 		console.log("error@upgrade-nftvault", error)
        // 	}
        // }
        console.log({ deployedAddresses });
        for (const nftVaultAddress of deployedAddresses) {
            try {
                if (network.name != "hardhat") {
                    console.log("Verifying NFTVault");
                    await run("verify:verify", {
                        address: nftVaultAddress,
                        constructorArguments: []
                    });
                }
            } catch (e) {
                console.error("error@verify", e);
            }
        }
    }
);
