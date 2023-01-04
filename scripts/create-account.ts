import hre from "hardhat";
import { Create2Factory } from "../src/Create2Factory";
import { ethers } from "hardhat";

const PAYMASTER_STAKE = ethers.utils.parseEther("0.001");
const PAYMASTER_DEPOSIT = ethers.utils.parseEther("0.1");

async function main() {
  // const provider = ethers.provider;
  // const from = await provider.getSigner().getAddress();
  // await new Create2Factory(ethers.provider).deployFactory();
  //
  // const entryPoint = await hre.deployments.deploy("EntryPoint", {
  //   from,
  //   gasLimit: 6e6,
  //   deterministicDeployment: true,
  // });
  // console.log("==EntryPoint addr=", entryPoint.address);
  //
  // const simpleAccountDeployer = await hre.deployments.deploy("SimpleAccount", {
  //   from,
  //   args: [entryPoint.address, from],
  //   deterministicDeployment: true,
  // });
  // console.log("==SimpleAccountDeployer addr=", simpleAccountDeployer.address);
  //
  // const { paymasterOwner } = await hre.getNamedAccounts();
  // const paymasterOwnerSigner = await ethers.getSigner(paymasterOwner);
  //
  // const verifyingPaymaster = await hre.deployments.deploy(
  //   "VerifyingPaymaster",
  //   {
  //     from: paymasterOwner,
  //     args: [entryPoint.address, paymasterOwner],
  //   }
  // );
  // console.log("==VerifyingPaymaster addr=", verifyingPaymaster.address);
  // console.log("==VerifyingPaymaster owner=", paymasterOwner);
  //
  // const vpContract = (
  //   await ethers.getContractAt("VerifyingPaymaster", verifyingPaymaster.address)
  // ).connect(paymasterOwnerSigner);
  //
  // // stake and deposit for the paymaster
  // let tx = await vpContract.addStake(1, {
  //   value: PAYMASTER_STAKE,
  // });
  // await tx.wait();
  // console.log("Paymaster staked");
  //
  // tx = await vpContract.deposit({
  //   value: PAYMASTER_DEPOSIT,
  // });
  // await tx.wait();
  // console.log("Paymaster deposited");

  // --

  const ep = await ethers.getContractAt("EntryPoint", "0x15ceF249Ce6A2A8cEdc4aBc8c5c177DDC59c2180");
  const result = await ep.callStatic.getSenderAddress(
    "0xa45b7c2078ce56b1e25fe722f4534f7eda0fec863bf2c3e700000000000000000000000015cef249ce6a2a8cedc4abc8c5c177ddc59c2180000000000000000000000000fc849699413d7b64a58bf286427814861afb55ca0000000000000000000000000000000000000000000000000000000000000000"
  );

  console.log("==result=", result);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
