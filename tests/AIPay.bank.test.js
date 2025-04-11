const { expect } = require("chai");
const { ethers } = require("hardhat");
const toWei = (val) => ethers.utils.parseEther("" + val);

describe("InternalFactory Contract", function () {
    beforeEach(async function () {
        [owner, addr1, addr2, addr3, addr4, admin] = await ethers.getSigners();

        const ERC20Factory = await ethers.getContractFactory("ERC20Sample");
        usdt = await ERC20Factory.connect(owner).deploy("USDTToken", "USDT");
        await usdt.deployed();
    
        // Transfer USDT from owner to user1, user2, user3
        await usdt.connect(owner).transfer(addr1.address, toWei(1000));
        await usdt.connect(owner).transfer(addr2.address, toWei(1000));
        await usdt.connect(owner).transfer(addr3.address, toWei(1000));
    
        const ERC20TOPFactory = await ethers.getContractFactory("ERC20Sample");
        topToken = await ERC20TOPFactory.connect(owner).deploy("TOPToken", "TOP");
        await topToken.deployed();
    
        // Transfer USDT from owner to user1, user2, user3
        await topToken.connect(owner).transfer(addr1.address, toWei(1000));
        await topToken.connect(owner).transfer(addr2.address, toWei(1000));
        await topToken.connect(owner).transfer(addr3.address, toWei(1000));
    
        //bank contract
        const BankFactory = await ethers.getContractFactory("Bank");
        bank = await BankFactory.deploy(usdt.address, topToken.address);
        await bank.deployed();
    });

    describe("Deployment", function () {
        it("Should set the correct token addresses", async function () {
          expect(await bank.usdtToken()).to.equal(usdt.address);
          expect(await bank.topToken()).to.equal(topToken.address);
        });
    
        it("Should set the correct roles", async function () {         
          expect(await bank.hasRole(await bank.DEFAULT_ADMIN_ROLE(), owner.address)).to.equal(true);
          expect(await bank.hasRole(await bank.IMO_ROLE(), owner.address)).to.equal(true);
        });
    
        it("Should initialize with zero exchange rates", async function () {
          const [topRate, usdtRate] = await bank.usdtToTopRate();
          expect(topRate).to.equal(0);
          expect(usdtRate).to.equal(0);
        });
      });
    
      describe("Update USDT to TOP Rate", function () {
        it("Should update rate correctly", async function () {          
          // For this test: TOP has 18 decimals, USDT has 6 decimals
          // Difference: 12 decimals
          // Setting rate: 2 TOP = 1 USDT
          const topRate = 2;
          const usdtRate = 1;
          
          await bank.connect(owner).updateUsdtTopRate(topRate, usdtRate);
          
          const [actualTopRate, actualUsdtRate] = await bank.usdtToTopRate();
          // Expected: topRate * 10^(topDecimals - usdtDecimals) = 2 * 10^12
          const expectedTopRate = topRate; 
          expect(actualTopRate).to.equal(expectedTopRate);
          expect(actualUsdtRate).to.equal(usdtRate);
        });
    
        it("Should emit RateUpdated event with correct values", async function () {
          const topRate = 3;
          const usdtRate = 1;
          const expectedTopRate = topRate; // Adjusted for decimal difference
          
          // First update
          await expect(bank.connect(owner).updateUsdtTopRate(topRate, usdtRate))
            .to.emit(bank, "RateUpdated")
            .withArgs(0, 0, expectedTopRate, usdtRate);
          
          // Second update with different rates
          const newTopRate = 5;
          const newUsdtRate = 2;
          const expectedNewTopRate = newTopRate;
          
          await expect(bank.connect(owner).updateUsdtTopRate(newTopRate, newUsdtRate))
            .to.emit(bank, "RateUpdated")
            .withArgs(expectedTopRate, usdtRate, expectedNewTopRate, newUsdtRate);
        });
    
        it("Should revert if topRate is zero", async function () {
          await expect(bank.connect(owner).updateUsdtTopRate(0, 1))
            .to.be.revertedWith("New rate must be greater than 0");
        });
    
        it("Should revert if usdtRate is zero", async function () {
          await expect(bank.connect(owner).updateUsdtTopRate(1, 0))
            .to.be.revertedWith("New rate must be greater than 0");
        });
    
        it("Should revert if both rates are zero", async function () {
          await expect(bank.connect(owner).updateUsdtTopRate(0, 0))
            .to.be.revertedWith("New rate must be greater than 0");
        });
    
        it("Should revert if called by non-IMO role", async function () {
          await expect(bank.connect(addr4).updateUsdtTopRate(2, 1))
            .to.be.reverted;
        });
      });
    
      describe("Withdraw USDT", function () {
        it("Should allow IMO member to withdraw USDT", async function () {

          await usdt.connect(owner).transfer(bank.address, toWei(10000));
          const withdrawAmount = ethers.utils.parseUnits("1000", 6);
          const initialBalance = await usdt.balanceOf(owner.address);
          const initialBankBalance = await usdt.balanceOf(bank.address);
          
          await bank.connect(owner).withdrawUSDT(withdrawAmount);
          
          // Check balances after withdrawal
          const finalBalance = await usdt.balanceOf(owner.address);
          const finalBankBalance = await usdt.balanceOf(bank.address);
          
          expect(finalBalance.sub(initialBalance)).to.equal(withdrawAmount);
          expect(initialBankBalance.sub(finalBankBalance)).to.equal(withdrawAmount);
        });
    
        it("Should emit USDTWithdrawn event", async function () {
          const withdrawAmount = ethers.utils.parseUnits("1000", 6);

          await usdt.connect(owner).transfer(bank.address, toWei(1000));
          
          await expect(bank.connect(owner).withdrawUSDT(withdrawAmount))
            .to.emit(bank, "USDTWithdrawn")
            .withArgs(owner.address, withdrawAmount);
        });
    
        it("Should revert if trying to withdraw more than balance", async function () {
          const bankBalance = await usdt.balanceOf(bank.address);
          const exceedingAmount = bankBalance.add(1);
          
          await usdt.connect(owner).transfer(bank.address, bankBalance);
          await expect(bank.connect(owner).withdrawUSDT(exceedingAmount))
            .to.be.revertedWith("Insufficient USDT balance");
        });
    
        it("Should revert if called by non-IMO member", async function () {
          const withdrawAmount = ethers.utils.parseUnits("1000", 6);
          
          await expect(bank.connect(addr4).withdrawUSDT(withdrawAmount))
            .to.be.reverted;
        });
    
        it("Should withdraw the exact amount requested", async function () {
   
          // Try different withdrawal amounts
          const amounts = [
            ethers.utils.parseUnits("100", 6),
            ethers.utils.parseUnits("500", 6),
            ethers.utils.parseUnits("1", 6),
          ];

          await usdt.connect(owner).transfer(bank.address, toWei(10000));
          
          for (const amount of amounts) {
            const initialIMOBalance = await usdt.balanceOf(owner.address);
            const initialBankBalance = await usdt.balanceOf(bank.address);
            
            await bank.connect(owner).withdrawUSDT(amount);
            
            const finalIMOBalance = await usdt.balanceOf(owner.address);
            const finalBankBalance = await usdt.balanceOf(bank.address);
            
            expect(finalIMOBalance.sub(initialIMOBalance)).to.equal(amount);
            expect(initialBankBalance.sub(finalBankBalance)).to.equal(amount);
          }
        });
    });
});