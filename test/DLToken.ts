import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import hre from "hardhat";

describe("DLToken Contract", function () {
  // Fixture to deploy the contract
  async function deployDLTokenFixture() {
    const DLToken = await hre.ethers.getContractFactory("DLToken");
    const [owner, user1, user2] = await hre.ethers.getSigners();
    const dlToken = await DLToken.deploy("DLToken", "DLT");
    
    return { dlToken, owner, user1, user2 };
  }

  it("Should deploy the contract with initial total supply", async function () {
    const { dlToken, owner } = await loadFixture(deployDLTokenFixture);
    
    const totalSupply = await dlToken.getTotalSupply();
    const ownerBalance = await dlToken.balanceOf(owner.address);
    
    expect(totalSupply).to.equal(1_000_000 * (10 ** 18));
    expect(ownerBalance).to.equal(1_000_000 * (10 ** 18));
  });

  it("Should return correct token name and symbol", async function () {
    const { dlToken } = await loadFixture(deployDLTokenFixture);

    const name = await dlToken.getTokenName();
    const symbol = await dlToken.getSymbol();

    expect(name).to.equal("DLToken");
    expect(symbol).to.equal("DLT");
  });

  it("Should transfer tokens correctly", async function () {
    const { dlToken, owner, user1 } = await loadFixture(deployDLTokenFixture);

    const amountToTransfer = 2000;
    const ownerInitialBalance = await dlToken.balanceOf(owner.address);

    await expect(dlToken.transfer(user1.address, amountToTransfer))
      .to.emit(dlToken, "Transfer")
      .withArgs(owner.address, user1.address, amountToTransfer);

    const ownerFinalBalance = await dlToken.balanceOf(owner.address);
    const user1Balance = await dlToken.balanceOf(user1.address);

    expect(user1Balance).to.equal(amountToTransfer);
    const fivePercent = (5 * amountToTransfer) / 100;
    expect(ownerFinalBalance).to.equal(ownerInitialBalance.sub(amountToTransfer).sub(fivePercent));
  });

  it("Should correctly burn 5% of the transferred amount", async function () {
    const { dlToken, owner, user1 } = await loadFixture(deployDLTokenFixture);


    const initialTotalSupply = await dlToken.getTotalSupply();

    await dlToken.transfer(user1.address, 2000);

    const finalTotalSupply = await dlToken.getTotalSupply();
    const amountToTransfer = 1000;

    const fivePercent = (5 * amountToTransfer) / 100;

    expect(finalTotalSupply).to.equal(initialTotalSupply.sub(fivePercent));
  });

  it("Should approve and allow delegated transfers", async function () {
    const { dlToken, owner, user1, user2 } = await loadFixture(deployDLTokenFixture);

    const amountToApprove = 2000;

    await expect(dlToken.approve(user1.address, amountToApprove))
      .to.emit(dlToken, "Approval")
      .withArgs(owner.address, user1.address, amountToApprove);

    const allowance = await dlToken.allowance(owner.address, user1.address);
    expect(allowance).to.equal(amountToApprove);

    // Perform transferFrom by user1 on behalf of owner

    await expect(dlToken.connect(user1).transferFrom(owner.address, user2.address, amountToApprove))
      .to.emit(dlToken, "Transfer")
      .withArgs(owner.address, user2.address, amountToApprove);

    const user2Balance = await dlToken.balanceOf(user2.address);
    expect(user2Balance).to.equal(amountToApprove);
  });

  it("Should not allow transferring more than balance", async function () {
    const { dlToken, user1 } = await loadFixture(deployDLTokenFixture);

    const amountToTransfer = 3000;

    await expect(dlToken.connect(user1).transfer(user1.address, amountToTransfer))
      .to.be.revertedWith("You can't take more than what is avaliable");
  });

  it("Should not allow approving more than balance", async function () {
    const { dlToken, user1, user2 } = await loadFixture(deployDLTokenFixture);

    const amountToApprove = hre.ethers.utils.parseUnits("1000", 18);

    await expect(dlToken.connect(user1).approve(user2.address, amountToApprove))
      .to.be.revertedWith("Balance is not enough");
  });

  it("Should burn tokens correctly when transferred or approved", async function () {
    const { dlToken, owner, user1, user2 } = await loadFixture(deployDLTokenFixture);

    const amountToTransfer = hre.ethers.utils.parseUnits("200", 18);
    
    // Transfer directly
    await dlToken.transfer(user1.address, amountToTransfer);
    const fivePercent = amountToTransfer.mul(5).div(100);
    const totalSupplyAfterTransfer = await dlToken.getTotalSupply();
    
    expect(totalSupplyAfterTransfer).to.equal(1_000_000 * (10 ** 18) - fivePercent);

    // Approve and transferFrom
    await dlToken.approve(user1.address, amountToTransfer);
    await dlToken.connect(user1).transferFrom(owner.address, user2.address, amountToTransfer);

    const totalSupplyAfterTransferFrom = await dlToken.getTotalSupply();
    expect(totalSupplyAfterTransferFrom).to.equal(totalSupplyAfterTransfer.sub(fivePercent));
  });
});
