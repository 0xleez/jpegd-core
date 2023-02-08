import fs from "fs";
import path from "path";
import { getProxyAdminFactory } from "@openzeppelin/hardhat-upgrades/dist/utils";
import { task, types } from "hardhat/config";

import { DAO_ROLE } from "./constants";

task("deploy-nftVault", "Deploys the NFTVault contract")
	.addParam("vaultconfig", "A JSON file containing the vault's configuration", undefined, types.inputFile)
	.setAction(async ({ vaultconfig }, { network, ethers, run, upgrades }) => {
		const configFilePath = path.join(__dirname, "config", network.name + ".json");
		const config = await JSON.parse(fs.readFileSync(configFilePath).toString());

		if (!config.pusd)
			throw "No PUSD address in network's config file";
		if (!config.jpeg)
			throw "No JPEG address in network's config file";
		if (!config.ethOracle)
			throw "No ETHOracle address in network's config file";
		if (!config.cigStaking)
			throw "No JPEGCardsCigStaking address in network's config file";
		if (!config.dao)
			throw "No DAO address in network's config file";

		const vaultConfig = await JSON.parse(fs.readFileSync(vaultconfig).toString());

		if (!vaultConfig.nft)
			throw "No NFT in vault's config file";
		if (!vaultConfig.floorOracle)
			throw "No floor oracle in vault's config file";
		if (!vaultConfig.debtInterestApr)
			throw "No debt interest apr in vault's config file"
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
			],
		]);

		console.log("NFTVault for ", vaultConfig.nft, " deployed at: ", nftVault.address);

		config["pethNftVault-" + vaultConfig.nft.substring(vaultConfig.nft.length - 5)] = nftVault.address;
		fs.writeFileSync(configFilePath, JSON.stringify(config));

		console.log("Setting up NFTVault");

		await (await nftVault.grantRole(DAO_ROLE, config.dao)).wait();
		// await (await nftVault.revokeRole(DAO_ROLE, deployer.address)).wait();

		if (network.name != "hardhat") {
			console.log("Verifying NFTVault");

			const nftVaultImplementation = await (await upgrades.admin.getInstance()).getProxyImplementation(nftVault.address);

			await run("verify:verify", {
				address: nftVaultImplementation.address,
				constructorArguments: [],
			});
		}

		console.log("All done.");
	});

task("deploy-nftVaultImpl", "Upgrades the NFTVault contract")
	.setAction(async ({ }, { network, ethers, run, upgrades }) => {
		const [deployer] = await ethers.getSigners();
		console.log("Deployer: ", deployer.address);
		
		const NFTVault = await ethers.getContractFactory("PETHNFTVault");
		const nftVault = await NFTVault.deploy()
		await nftVault.deployed()
		console.log("deploy at: ", nftVault.address)

		if (network.name != "hardhat") {
			console.log("Verifying NFTVault");
			await run("verify:verify", {
				address: nftVault.address,
				constructorArguments: [],
			});
		}
	})

task("deploy-jpegOracleAggregator", "Deploys the JPEGOraclesAggregator contract")
	.setAction(async ({  }, { network, ethers, run, upgrades }) => {
		const configFilePath = path.join(__dirname, "config", network.name + ".json");
		const config = await JSON.parse(fs.readFileSync(configFilePath).toString());

		if (!config.jpeg)
			throw "No jpeg address in network's config file";

		const [deployer] = await ethers.getSigners();
		console.log("Deployer: ", deployer.address);
		
		const JPEGOraclesAggregator = await ethers.getContractFactory("JPEGOraclesAggregator");
		const oracle = await JPEGOraclesAggregator.deploy(config.jpeg)
		console.log("deployed at: ", oracle.address)
		
		if (network.name != "hardhat") {
			console.log("Verifying oracle");
			await run("verify:verify", {
				address: oracle.address,
				constructorArguments: [config.jpeg],
			});
		}
	})

task("deploy-nftprovider", "Deploys the NFTValueProvider contract")
	.addParam("vaultconfig", "A JSON file containing the vault's configuration", undefined, types.inputFile)
	.addParam("collection", "The collection name", undefined, types.string)
	.setAction(async ({ vaultconfig, collection }, { network, ethers, run, upgrades }) => {
		const configFilePath = path.join(__dirname, "config", network.name + ".json");
		const config = await JSON.parse(fs.readFileSync(configFilePath).toString());

		if (!config.jpeg)
			throw "No jpeg address in network's config file";
			
		const vaultConfig = await JSON.parse(fs.readFileSync(vaultconfig).toString());
		if (!vaultConfig.jpegOraclesAggregator)
			throw "No jpegOraclesAggregator address in network's config file";
		if (!vaultConfig.valueIncreaseLockRate)
			throw "No valueIncreaseLockRate field in network's config file";
			
		const [deployer] = await ethers.getSigners();
		console.log("Deployer: ", deployer.address);
		
		const NFTValueProvider = await ethers.getContractFactory("NFTValueProvider");
		const nftValueprovider = await upgrades.deployProxy(NFTValueProvider, [
			config.jpeg,
			vaultConfig.jpegOraclesAggregator,
			vaultConfig.valueIncreaseLockRate,
			"0",
		]);
		console.log("deployed at: ", nftValueprovider.address)

		config["nftValueProvider-" + collection] = nftValueprovider.address;
		fs.writeFileSync(configFilePath, JSON.stringify(config));

		if (network.name != "hardhat") {
			console.log("Verifying oracle");
			await run("verify:verify", {
				address: nftValueprovider.address,
				constructorArguments: [],
			});
		}
	})

task("deploy-providerImpl", "Deploy NFTValueProvider impl")
	.setAction(async ({ }, { network, ethers, run, upgrades }) => {
		const Provider = await ethers.getContractFactory("NFTValueProvider");
		const provider = await Provider.deploy()
		console.log("deploy at: ", provider.address)
		await provider.deployed()

		if (network.name != "hardhat") {
			console.log("Verifying NFTVault");
			await run("verify:verify", {
				address: provider.address,
				constructorArguments: [],
			});
		}
	})

task("deploy-vaultrouter", "Deploy the JPEGVaultRouter contract")
	.setAction(async ({ }, { network, ethers, run, upgrades }) => {
		const JPEGVaultRouter = await ethers.getContractFactory("JPEGVaultRouter");
		const jpegVaultRouter = await upgrades.deployProxy(JPEGVaultRouter);
		console.log("deployed at: ", jpegVaultRouter.address)
		await jpegVaultRouter.deployed()

		const configFilePath = path.join(__dirname, "config", network.name + ".json");
		const config = await JSON.parse(fs.readFileSync(configFilePath).toString());
		config.jpegVaultRouter = jpegVaultRouter.address;
		fs.writeFileSync(configFilePath, JSON.stringify(config));

		if (network.name != "hardhat") {
			console.log("Verifying jpegVaultRouter");

			const impl = await (await upgrades.admin.getInstance()).getProxyImplementation(config.jpegVaultRouter);

			await run("verify:verify", {
				address: impl.address,
				constructorArguments: [],
			});
		}
	})

task("update-nftVaultImpl", "Upgrades the NFTVault contract")
	.setAction(async ({}, hre) => {
		const { network, ethers, run, upgrades } = hre
		const [deployer] = await ethers.getSigners();
		console.log("Deployer: ", deployer.address);
		
		const ProxyAdmin = await getProxyAdminFactory(hre);
		const proxyAdmin = ProxyAdmin.attach("0x01117554764418EAc866F4701f6438c06b28d5F2");

		const proxies = [
			["0x33c52E377CF7D76a97b93C337cDd1a42c9dDE019", "NFTVault"],
			["0x4D057e43316058F4Ae2199954f79dD19952a548B", "NFTVault"],
			["0x26916b8F7f76cF2b5FeD919A97E66acdb83Fbe80", "NFTVault"],
			["0x601666b790CE63c221266BcC4fecBB505DdC31cb", "NFTVault"],
			["0x148266c9EB56D03D5B2425610C828144A4DeF702", "PETHNFTVault"],
			["0xAF887649F859921614Fd018cFB32E27DA6547093", "PETHNFTVault"],
			["0x3c1fE934a1918FDaAA7264B7AdF7eF2f905dd079", "PETHNFTVault"],
			["0x1f25109d1BE568b70cc159bC97f131cD493D58ee", "PETHNFTVault"],
		]
		for (let i = 0; i < proxies.length; i++) {
			try { 
				const [proxyAddress, contractName] = proxies[i]
				const NftVault = await ethers.getContractFactory(contractName);
				const nftVault = await NftVault.deploy()
				await nftVault.deployed()
				console.log("=====[deploy at]====== ", nftVault.address, " proxyAddress:", proxyAddress)

				await proxyAdmin.connect(deployer).upgrade(proxyAddress, nftVault.address);

				try {
					if (network.name != "hardhat") {
						console.log("Verifying NFTVault");
						await run("verify:verify", {
							address: nftVault.address,
							constructorArguments: [],
						});
					}
				}catch(e) {
					console.error("error@verify", e)
				}

				const vault = await ethers.getContractAt(contractName, proxyAddress, deployer);
				await (await vault.grantRole("0x61c92169ef077349011ff0b1383c894d86c5f0b41d986366b58a6cf31e93beda", "0x531277aa28cd919b8386b4c2013ed7f4df3b8a21")).wait();
				await (await vault.finalizeUpgrade()).wait()
				await (await vault.grantRole("0x7a05a596cb0ce7fdea8a1e1ec73be300bdb35097c944ce1897202f7a13122eb2", "0xF9423E5cc3eE0956e7cB43BC7fffA9EA4C293F4d")).wait();
				console.log(i, "done")
			} catch(error) {
				console.log("error@upgrade-nftvault", error)
			}
		}
	})


task("update-providerImpl", "Upgrades the NFTVault contract")
	.setAction(async ({}, hre) => {
		const { network, ethers, run, upgrades } = hre
		const [deployer] = await ethers.getSigners();
		console.log("Deployer: ", deployer.address);
		
		const ProxyAdmin = await getProxyAdminFactory(hre);
		const proxyAdmin = ProxyAdmin.attach("0x01117554764418EAc866F4701f6438c06b28d5F2");

		const proxies = [
			"0x51CAA94e52b48849e2314d8959eB416E646aa65D", // punks
			"0xb145723aEDE3e847Cb2C7B78BF55eD3bF963673e", // rocks
			"0xd419bf430A446185497331A8364Ef054166caa84", // bayc
			"0x460cA887a7a85fB06c3AcCC660FcA7A39B537Cbb", // mayc
		]

		const deployedAddresses: string[] = []
		
		const NFTValueProvider = await ethers.getContractFactory("NFTValueProvider");
		const nFTValueProvider = await NFTValueProvider.deploy()
		await nFTValueProvider.deployed()
		deployedAddresses.push(nFTValueProvider.address)
		console.log("=====[deploy at]====== ", nFTValueProvider.address)

		for (let i = 0; i < proxies.length; i++) {
			try { 
				const proxyAddress = proxies[i]
				await proxyAdmin.connect(deployer).upgrade(proxyAddress, nFTValueProvider.address);
				console.log(i, "done")
			} catch(error) {
				console.log("error@upgrade-nftvault", error)
			}
		}

		console.log({ deployedAddresses })
		for (const nftVaultAddress of deployedAddresses) {
			try {
				if (network.name != "hardhat") {
					console.log("Verifying NFTVault");
					await run("verify:verify", {
						address: nftVaultAddress,
						constructorArguments: [],
					});
				}
			}catch(e) {
				console.error("error@verify", e)
			}
		}
	})


