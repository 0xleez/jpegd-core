import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import chai from "chai";
import { solidity } from "ethereum-waffle";
import { BigNumber } from "ethers";
import { AbiCoder } from "ethers/lib/utils";
import { ethers, upgrades } from "hardhat";
import {
    ApeMatchingMarketplace,
    MockApeStaking,
    TestERC20,
    TestERC721
} from "../types";
import { units } from "./utils";

const { expect } = chai;

const STRATEGY_ROLE = ethers.utils.solidityKeccak256(
    ["string"],
    ["STRATEGY_ROLE"]
);

const MINTER_ROLE = ethers.utils.solidityKeccak256(["string"], ["MINTER_ROLE"]);
chai.use(solidity);

const abiCoder = new AbiCoder();

describe("ApeMatchingMarketplace", () => {
    let owner: SignerWithAddress,
        strategy: SignerWithAddress,
        user: SignerWithAddress;
    let ape: TestERC20;
    let bayc: TestERC721, mayc: TestERC721, bakc: TestERC721;
    let apeStaking: MockApeStaking;
    let marketplace: ApeMatchingMarketplace;

    function depositApe(
        account: SignerWithAddress,
        nonce: number,
        amount: BigNumber
    ) {
        return marketplace
            .connect(account)
            .doActions(
                [0],
                [abiCoder.encode(["uint24", "uint80"], [nonce, amount])]
            );
    }

    function withdrawApe(
        account: SignerWithAddress,
        nonce: number,
        amount: BigNumber
    ) {
        return marketplace
            .connect(account)
            .doActions(
                [1],
                [abiCoder.encode(["uint24", "uint80"], [nonce, amount])]
            );
    }

    function claimRewards(account: SignerWithAddress, nonce: number) {
        return marketplace
            .connect(account)
            .doActions([2], [abiCoder.encode(["uint24"], [nonce])]);
    }

    beforeEach(async () => {
        const accounts = await ethers.getSigners();
        owner = accounts[0];
        strategy = accounts[1];
        user = accounts[2];

        const ERC20 = await ethers.getContractFactory("TestERC20");
        ape = await ERC20.deploy("", "");

        const ERC721 = await ethers.getContractFactory("TestERC721");
        bayc = await ERC721.deploy();
        mayc = await ERC721.deploy();
        bakc = await ERC721.deploy();

        const ApeStaking = await ethers.getContractFactory("MockApeStaking");
        apeStaking = await ApeStaking.deploy(
            ape.address,
            bayc.address,
            mayc.address,
            bakc.address
        );

        const Marketplace = await ethers.getContractFactory(
            "ApeMatchingMarketplace"
        );
        marketplace = <ApeMatchingMarketplace>await upgrades.deployProxy(
            Marketplace,
            [],
            {
                constructorArgs: [
                    apeStaking.address,
                    ape.address,
                    bayc.address,
                    mayc.address,
                    bakc.address
                ]
            }
        );

        await marketplace.grantRole(STRATEGY_ROLE, strategy.address);
        await ape.grantRole(MINTER_ROLE, apeStaking.address);
    });

    it("should allow the strategy to create offers", async () => {
        await bayc.mint(marketplace.address, 100);
        await ape.mint(user.address, units(20));
        await ape.connect(user).approve(marketplace.address, units(20));

        await expect(
            marketplace
                .connect(strategy)
                .createOffers(
                    user.address,
                    { collection: 0, tokenId: 100 },
                    units(10),
                    0,
                    0,
                    0,
                    0
                )
        ).to.be.revertedWith("InvalidRewardShare()");

        await expect(
            marketplace
                .connect(strategy)
                .createOffers(
                    user.address,
                    { collection: 0, tokenId: 100 },
                    units(10),
                    0,
                    11000,
                    0,
                    0
                )
        ).to.be.revertedWith("InvalidRewardShare()");

        await marketplace
            .connect(strategy)
            .createOffers(
                user.address,
                { collection: 0, tokenId: 100 },
                units(10),
                0,
                7_000,
                7_000,
                1_500
            );

        expect(await ape.balanceOf(user.address)).to.equal(units(10));
        expect(await ape.balanceOf(apeStaking.address)).to.equal(units(10));
        expect((await apeStaking.nftPosition(1, 100))[0]).to.equal(units(10));

        let mainOffer = await marketplace.offers(0);
        expect(mainOffer.offerType).to.equal(1);
        expect(mainOffer.mainNft.collection).to.equal(0);
        expect(mainOffer.mainNft.tokenId).to.equal(100);
        expect(mainOffer.bakcTokenId).to.equal(0);
        expect(mainOffer.apeAmount).to.equal(units(10));
        expect(mainOffer.apeRewardShareBps).to.equal(7_000);
        expect(mainOffer.bakcRewardShareBps).to.equal(0);
        expect(mainOffer.isPaired).to.be.false;
        expect(mainOffer.lastSingleStakingRewardPerShare).to.equal(0);

        let mainPosition = await marketplace.positions(0, user.address);
        expect(mainPosition.apeAmount).to.equal(units(10));
        expect(mainPosition.lastRewardsPerShare).to.equal(0);
        expect(mainPosition.isOwner).to.be.true;
        expect(mainPosition.isBAKCOwner).to.be.false;
        expect(mainPosition.isSingleStaking).to.be.false;

        let bakcOffer = await marketplace.offers(1);
        expect(bakcOffer.offerType).to.equal(2);
        expect(bakcOffer.mainNft.collection).to.equal(0);
        expect(bakcOffer.mainNft.tokenId).to.equal(100);
        expect(bakcOffer.bakcTokenId).to.equal(0);
        expect(bakcOffer.apeAmount).to.equal(0);
        expect(bakcOffer.apeRewardShareBps).to.equal(7_000);
        expect(bakcOffer.bakcRewardShareBps).to.equal(1_500);
        expect(bakcOffer.isPaired).to.be.false;
        expect(bakcOffer.lastSingleStakingRewardPerShare).to.equal(0);

        let bakcPosition = await marketplace.positions(1, user.address);
        expect(bakcPosition.apeAmount).to.equal(0);
        expect(bakcPosition.lastRewardsPerShare).to.equal(0);
        expect(bakcPosition.isOwner).to.be.true;
        expect(bakcPosition.isBAKCOwner).to.be.false;
        expect(bakcPosition.isSingleStaking).to.be.false;

        let deposit = await marketplace.mainDeposits(0, 100);
        expect(deposit.mainOrderNonce).to.equal(0);
        expect(deposit.bakcOrderNonce).to.equal(1);
        expect(deposit.isDeposited).to.be.true;

        await mayc.mint(marketplace.address, 100);

        await marketplace
            .connect(strategy)
            .createOffers(
                user.address,
                { collection: 1, tokenId: 100 },
                0,
                units(10),
                7_000,
                7_000,
                1_500
            );

        expect(await ape.balanceOf(user.address)).to.equal(0);
        expect(await ape.balanceOf(apeStaking.address)).to.equal(units(10));
        expect(await ape.balanceOf(marketplace.address)).to.equal(units(10));
        expect((await apeStaking.nftPosition(2, 100))[0]).to.equal(0);

        mainOffer = await marketplace.offers(2);
        expect(mainOffer.offerType).to.equal(1);
        expect(mainOffer.mainNft.collection).to.equal(1);
        expect(mainOffer.mainNft.tokenId).to.equal(100);
        expect(mainOffer.bakcTokenId).to.equal(0);
        expect(mainOffer.apeAmount).to.equal(0);
        expect(mainOffer.apeRewardShareBps).to.equal(7_000);
        expect(mainOffer.bakcRewardShareBps).to.equal(0);
        expect(mainOffer.isPaired).to.be.false;
        expect(mainOffer.lastSingleStakingRewardPerShare).to.equal(0);

        mainPosition = await marketplace.positions(2, user.address);
        expect(mainPosition.apeAmount).to.equal(0);
        expect(mainPosition.lastRewardsPerShare).to.equal(0);
        expect(mainPosition.isOwner).to.be.true;
        expect(mainPosition.isBAKCOwner).to.be.false;
        expect(mainPosition.isSingleStaking).to.be.false;

        bakcOffer = await marketplace.offers(3);
        expect(bakcOffer.offerType).to.equal(2);
        expect(bakcOffer.mainNft.collection).to.equal(1);
        expect(bakcOffer.mainNft.tokenId).to.equal(100);
        expect(bakcOffer.bakcTokenId).to.equal(0);
        expect(bakcOffer.apeAmount).to.equal(units(10));
        expect(bakcOffer.apeRewardShareBps).to.equal(7_000);
        expect(bakcOffer.bakcRewardShareBps).to.equal(1_500);
        expect(bakcOffer.isPaired).to.be.false;
        expect(bakcOffer.lastSingleStakingRewardPerShare).to.equal(0);

        bakcPosition = await marketplace.positions(3, user.address);
        expect(bakcPosition.apeAmount).to.equal(units(10));
        expect(bakcPosition.lastRewardsPerShare).to.equal(0);
        expect(bakcPosition.isOwner).to.be.true;
        expect(bakcPosition.isBAKCOwner).to.be.false;
        expect(bakcPosition.isSingleStaking).to.be.false;

        deposit = await marketplace.mainDeposits(1, 100);
        expect(deposit.mainOrderNonce).to.equal(2);
        expect(deposit.bakcOrderNonce).to.equal(3);
        expect(deposit.isDeposited).to.be.true;
    });

    it("should allow users to deposit ape tokens", async () => {
        await mayc.mint(marketplace.address, 100);
        await ape.mint(user.address, units(20));
        await ape.connect(user).approve(marketplace.address, units(20));

        await marketplace
            .connect(strategy)
            .createOffers(
                user.address,
                { collection: 1, tokenId: 100 },
                0,
                0,
                7_000,
                7_000,
                1_500
            );

        await expect(depositApe(user, 0, units(0.5))).to.be.revertedWith(
            "InvalidAmount()"
        );

        await expect(depositApe(user, 0, units(11_000))).to.be.revertedWith(
            "InvalidAmount()"
        );

        await depositApe(user, 0, units(10));
        expect(await ape.balanceOf(user.address)).to.equal(units(10));
        expect(await ape.balanceOf(marketplace.address)).to.equal(0);
        expect(await ape.balanceOf(apeStaking.address)).to.equal(units(10));

        let offer = await marketplace.offers(0);
        expect(offer.apeAmount).to.equal(units(10));

        let position = await marketplace.positions(0, user.address);
        expect(position.apeAmount).to.equal(units(10));
    });

    it("should allow users to withdraw ape tokens", async () => {
        await bayc.mint(marketplace.address, 100);
        await ape.mint(user.address, units(20));
        await ape.connect(user).approve(marketplace.address, units(20));

        await marketplace
            .connect(strategy)
            .createOffers(
                user.address,
                { collection: 0, tokenId: 100 },
                units(10),
                0,
                7_000,
                7_000,
                1_500
            );

        await expect(withdrawApe(user, 0, units(0.5))).to.be.revertedWith(
            "InvalidAmount()"
        );

        await expect(withdrawApe(user, 0, units(20))).to.be.revertedWith(
            "InvalidAmount()"
        );

        await expect(withdrawApe(user, 0, units(9.5))).to.be.revertedWith(
            "InvalidAmount()"
        );

        await withdrawApe(user, 0, units(10));
        expect(await ape.balanceOf(user.address)).to.equal(units(20));
        expect(await ape.balanceOf(marketplace.address)).to.equal(0);
        expect(await ape.balanceOf(apeStaking.address)).to.equal(0);

        let offer = await marketplace.offers(0);
        expect(offer.apeAmount).to.equal(0);

        let position = await marketplace.positions(0, user.address);
        expect(position.apeAmount).to.equal(0);
    });

    it("should allow the strategy to deposit BAKCs", async () => {
        await mayc.mint(marketplace.address, 100);
        await ape.mint(user.address, units(20));
        await ape.mint(owner.address, units(10));
        await ape.connect(user).approve(marketplace.address, units(20));
        await ape.connect(owner).approve(marketplace.address, units(10));

        await marketplace
            .connect(strategy)
            .createOffers(
                user.address,
                { collection: 1, tokenId: 100 },
                units(10),
                units(10),
                7_000,
                7_000,
                1_500
            );

        await bakc.mint(marketplace.address, 200);
        await expect(
            marketplace
                .connect(strategy)
                .depositBAKC(owner.address, 0, 200, units(10))
        ).to.be.revertedWith("InvalidOffer(0)");

        await marketplace
            .connect(strategy)
            .depositBAKC(owner.address, 1, 200, units(10));

        expect(await ape.balanceOf(owner.address)).to.equal(0);
        expect((await apeStaking.nftPosition(3, 200))[0]).to.equal(units(20));
        expect(await ape.balanceOf(marketplace.address)).to.equal(0);

        const offer = await marketplace.offers(1);
        expect(offer.apeAmount).to.equal(units(20));
        expect(offer.isPaired).to.be.true;
        expect(offer.bakcTokenId).to.equal(200);

        const position = await marketplace.positions(1, owner.address);
        expect(position.apeAmount).to.equal(units(10));
        expect(position.isBAKCOwner).to.be.true;

        const deposit = await marketplace.bakcDeposits(200);
        expect(deposit.isDeposited).to.be.true;
        expect(deposit.orderNonce).to.equal(1);
    });

    it("should allow users to claim rewards", async () => {
        await bayc.mint(marketplace.address, 100);
        await ape.mint(user.address, units(10));
        await ape.mint(owner.address, units(10));
        await ape.connect(user).approve(marketplace.address, units(10));
        await ape.connect(owner).approve(marketplace.address, units(10));

        await marketplace
            .connect(strategy)
            .createOffers(
                user.address,
                { collection: 0, tokenId: 100 },
                0,
                units(10),
                7_000,
                7_000,
                1_500
            );

        await bakc.mint(marketplace.address, 200);
        await marketplace
            .connect(strategy)
            .depositBAKC(owner.address, 1, 200, units(10));

        await expect(claimRewards(user, 1)).to.be.revertedWith("NoRewards()");

        await apeStaking.setPendingRewards(
            3,
            marketplace.address,
            200,
            units(100)
        );

        expect(await marketplace.pendingRewards(1, user.address)).to.equal(
            units(50)
        );
        await claimRewards(user, 1);
        expect(await marketplace.pendingRewards(1, user.address)).to.equal(0);

        expect(await marketplace.pendingRewards(1, owner.address)).to.equal(
            units(50)
        );
        await claimRewards(owner, 1);

        expect(await marketplace.pendingRewards(1, owner.address)).to.equal(0);

        expect(await ape.balanceOf(user.address)).to.equal(units(50));
        expect(await ape.balanceOf(owner.address)).to.equal(units(50));

        let position = await marketplace.positions(1, user.address);
        expect(position.lastRewardsPerShare).to.equal(units(3.5));

        position = await marketplace.positions(1, owner.address);
        expect(position.lastRewardsPerShare).to.equal(units(3.5));
    });

    it("should allow the strategy to withdraw BAKCs", async () => {
        await mayc.mint(marketplace.address, 100);
        await ape.mint(user.address, units(10));
        await ape.mint(owner.address, units(10));
        await ape.connect(user).approve(marketplace.address, units(10));
        await ape.connect(owner).approve(marketplace.address, units(10));

        await marketplace
            .connect(strategy)
            .createOffers(
                user.address,
                { collection: 1, tokenId: 100 },
                0,
                units(10),
                7_000,
                7_000,
                1_500
            );

        await bakc.mint(marketplace.address, 200);
        await marketplace
            .connect(strategy)
            .depositBAKC(owner.address, 1, 200, units(10));

        await apeStaking.setPendingRewards(
            3,
            marketplace.address,
            200,
            units(100)
        );

        await expect(
            marketplace
                .connect(strategy)
                .withdrawBAKC(user.address, 200, owner.address)
        ).to.be.revertedWith("Unauthorized()");

        await marketplace
            .connect(strategy)
            .withdrawBAKC(owner.address, 200, owner.address);

        expect((await apeStaking.nftPosition(3, 200))[0]).to.equal(0);

        expect(await marketplace.pendingRewards(1, owner.address)).to.equal(0);
        expect(await ape.balanceOf(marketplace.address)).to.equal(units(70));
        expect(await ape.balanceOf(owner.address)).to.equal(units(50));

        const deposit = await marketplace.bakcDeposits(200);
        expect(deposit.isDeposited).to.be.false;
        expect(deposit.orderNonce).to.equal(0);

        const offer = await marketplace.offers(1);
        expect(offer.apeAmount).to.equal(units(20));
        expect(offer.isPaired).to.be.false;
        expect(offer.bakcTokenId).to.equal(0);

        const position = await marketplace.positions(1, owner.address);
        expect(position.isBAKCOwner).to.be.false;
        expect(position.lastRewardsPerShare).to.equal(units(3.5));
        expect(position.apeAmount).to.equal(units(10));

        expect(await bakc.ownerOf(200)).to.equal(owner.address);
    });

    it("should allow the strategy to withdraw main NFTs", async () => {
        await bayc.mint(marketplace.address, 100);
        await ape.mint(user.address, units(20));
        await ape.mint(owner.address, units(10));
        await ape.connect(user).approve(marketplace.address, units(20));
        await ape.connect(owner).approve(marketplace.address, units(10));

        await marketplace
            .connect(strategy)
            .createOffers(
                user.address,
                { collection: 0, tokenId: 100 },
                units(10),
                units(10),
                7_000,
                7_000,
                1_500
            );

        await bakc.mint(marketplace.address, 200);
        await marketplace
            .connect(strategy)
            .depositBAKC(owner.address, 1, 200, units(10));

        await apeStaking.setPendingRewards(
            1,
            marketplace.address,
            200,
            units(100)
        );

        await apeStaking.setPendingRewards(
            3,
            marketplace.address,
            200,
            units(100)
        );

        await marketplace
            .connect(strategy)
            .withdrawMainNFT(user.address, 0, 100, user.address);

        const deposit = await marketplace.mainDeposits(0, 100);
        expect(deposit.isDeposited).to.be.false;
        expect(deposit.mainOrderNonce).to.equal(0);
        expect(deposit.bakcOrderNonce).to.equal(0);

        let offer = await marketplace.offers(0);
        expect(offer.offerType).to.equal(3);
        expect(offer.apeAmount).to.equal(0);

        let position = await marketplace.positions(0, user.address);
        expect(position.apeAmount).to.equal(0);
        expect(position.isOwner).to.be.false;

        offer = await marketplace.offers(1);
        expect(offer.offerType).to.equal(3);
        expect(offer.apeAmount).to.equal(units(10));
        expect(offer.lastSingleStakingRewardPerShare).to.equal(0);
        expect(offer.isPaired).to.be.true;
        expect(offer.bakcTokenId).to.equal(200);

        position = await marketplace.positions(1, user.address);
        expect(position.apeAmount).to.equal(0);
        expect(position.isOwner).to.be.false;

        const singleSide = await marketplace.singleStakingPool();
        expect(singleSide.apeAmount).to.equal(units(10));
        expect(singleSide.rewardsPerShare).to.equal(0);

        expect(await marketplace.pendingRewards(0, user.address)).to.equal(0);
        expect(await marketplace.pendingRewards(1, user.address)).to.equal(0);
        expect(await marketplace.pendingRewards(1, owner.address)).to.equal(
            units(50)
        );
        expect(await ape.balanceOf(apeStaking.address)).to.equal(units(10));
        expect(await ape.balanceOf(marketplace.address)).to.equal(units(50));
        expect(await ape.balanceOf(user.address)).to.equal(units(70));
    });

    it("should allow claiming from the single staking pool", async () => {
        await mayc.mint(marketplace.address, 100);
        await ape.mint(user.address, units(20));
        await ape.mint(owner.address, units(10));
        await ape.connect(user).approve(marketplace.address, units(20));
        await ape.connect(owner).approve(marketplace.address, units(10));

        await marketplace
            .connect(strategy)
            .createOffers(
                user.address,
                { collection: 1, tokenId: 100 },
                units(10),
                units(10),
                7_000,
                7_000,
                1_500
            );

        await bakc.mint(marketplace.address, 200);
        await marketplace
            .connect(strategy)
            .depositBAKC(owner.address, 1, 200, units(10));

        await apeStaking.setPendingRewards(
            3,
            marketplace.address,
            200,
            units(100)
        );

        await marketplace
            .connect(strategy)
            .withdrawMainNFT(user.address, 1, 100, user.address);

        expect(await mayc.ownerOf(100)).to.equal(user.address);

        expect(await marketplace.pendingRewards(1, owner.address)).equal(
            units(50)
        );

        await apeStaking.setPendingRewards(
            0,
            marketplace.address,
            0,
            units(100)
        );

        expect(await marketplace.pendingRewards(1, owner.address)).to.equal(
            units(150)
        );

        await claimRewards(owner, 1);

        expect(await marketplace.pendingRewards(1, owner.address)).to.equal(0);

        const pool = await marketplace.singleStakingPool();
        expect(pool.apeAmount).to.equal(units(10));
        expect(pool.rewardsPerShare).to.equal(units(10));

        const position = await marketplace.positions(1, owner.address);
        expect(position.apeAmount).to.equal(units(10));
        expect(position.isBAKCOwner).to.be.true;
        expect(position.lastRewardsPerShare).to.equal(units(10));
        expect(position.isSingleStaking).to.be.true;
    });

    it("should allow withdrawing from the apecoin pool", async () => {
        await bayc.mint(marketplace.address, 100);
        await ape.mint(owner.address, units(10));
        await ape.connect(owner).approve(marketplace.address, units(10));

        await marketplace
            .connect(strategy)
            .createOffers(
                user.address,
                { collection: 0, tokenId: 100 },
                0,
                0,
                7_000,
                7_000,
                1_500
            );

        await depositApe(owner, 0, units(10));

        await apeStaking.setPendingRewards(
            1,
            marketplace.address,
            100,
            units(100)
        );

        await marketplace
            .connect(strategy)
            .withdrawMainNFT(user.address, 0, 100, user.address);

        expect(await bayc.ownerOf(100)).to.equal(user.address);

        expect(await marketplace.pendingRewards(0, owner.address)).equal(
            units(70)
        );

        await apeStaking.setPendingRewards(
            0,
            marketplace.address,
            0,
            units(100)
        );

        expect(await marketplace.pendingRewards(0, owner.address)).to.equal(
            units(170)
        );

        await withdrawApe(owner, 0, units(10));

        expect(await marketplace.pendingRewards(0, owner.address)).to.equal(0);

        const offer = await marketplace.offers(0);
        expect(offer.apeAmount).to.equal(0);

        const pool = await marketplace.singleStakingPool();
        expect(pool.apeAmount).to.equal(0);
        expect(pool.rewardsPerShare).to.equal(units(10));

        const position = await marketplace.positions(0, owner.address);
        expect(position.apeAmount).to.equal(0);
        expect(position.lastRewardsPerShare).to.equal(units(10));
        expect(position.isSingleStaking).to.be.true;
    });
});
