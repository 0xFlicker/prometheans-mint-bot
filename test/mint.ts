import { ethers } from "hardhat";
import chai, { expect } from "chai";
import { solidity } from "ethereum-waffle";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import {
  PrometheansTest__factory,
  PrometheansSafeMint__factory,
  PrometheansTest,
  PrometheansSafeMint,
} from "../src/contracts";

chai.use(solidity);

describe("Minting test", function () {
  let accounts: SignerWithAddress[];
  let mint: PrometheansTest;
  let safeMint: PrometheansSafeMint;
  this.beforeEach(async () => {
    accounts = await ethers.getSigners();
    const [deployer] = accounts;
    const mintFactory = new PrometheansTest__factory(deployer);
    mint = await mintFactory.deploy();
    await mint.deployed();

    const safeMintFactory = new PrometheansSafeMint__factory(deployer);
    safeMint = await safeMintFactory.deploy(mint.address);
    await safeMint.deployed();
  });

  it("safe mint to", async () => {
    await mint.setCurrentEmber(60);
    const tx = await safeMint.mintTo(60, accounts[1].address);
    await tx.wait();
    expect(await mint.balanceOf(accounts[1].address)).to.be.eq(1);
  });

  it("safe mint to rejects", async () => {
    await mint.setCurrentEmber(61);
    await expect(safeMint.mintTo(60, accounts[1].address)).to.be.revertedWith(
      "too hot"
    );
  });

  it("safe mint", async () => {
    await mint.setCurrentEmber(60);
    const tx = await safeMint.mint(60);
    await tx.wait();
    expect(await mint.balanceOf(safeMint.address)).to.be.eq(1);

    // transfer to accounts[0]
    const tx2 = await mint["safeTransferFrom(address,address,uint256)"](
      safeMint.address,
      accounts[0].address,
      1
    );
    await tx2.wait();
    expect(await mint.balanceOf(safeMint.address)).to.be.eq(0);
    expect(await mint.balanceOf(accounts[0].address)).to.be.eq(1);
  });

  it("safe mint rejects", async () => {
    await mint.setCurrentEmber(61);
    await expect(safeMint.mint(60)).to.be.revertedWith("too hot");
  });
});
