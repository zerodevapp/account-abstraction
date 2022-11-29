import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { DeployFunction } from 'hardhat-deploy/types'
import { Create2Factory } from '../src/Create2Factory'
import { ethers } from 'hardhat'

const PAYMASTER_STAKE = ethers.utils.parseEther('0.001')
const PAYMASTER_DEPOSIT = ethers.utils.parseEther('1')

const deployEntryPoint: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const provider = ethers.provider
  const from = await provider.getSigner().getAddress()
  await new Create2Factory(ethers.provider).deployFactory()

  // const entryPoint = await hre.deployments.deploy(
  //   'EntryPoint',
  //   {
  //     from,
  //     args: [],
  //     gasLimit: 6e6,
  //     deterministicDeployment: true
  //   })
  // console.log('==EntryPoint addr=', entryPoint.address)

  const simpleWalletDeployer = await hre.deployments.deploy(
    'SimpleWalletDeployer',
    {
      from,
      deterministicDeployment: true
    })
  console.log('==SimpleWalletDeployer addr=', simpleWalletDeployer.address)

  // const { paymasterOwner } = (await hre.getNamedAccounts())
  // const paymasterOwnerSigner = await ethers.getSigner(paymasterOwner)

  // const verifyingPaymaster = await hre.deployments.deploy(
  //   'VerifyingPaymaster',
  //   {
  //     from: paymasterOwner,
  //     args: [entryPoint.address, paymasterOwner],
  //   })
  // console.log('==VerifyingPaymaster addr=', verifyingPaymaster.address)
  // console.log('==VerifyingPaymaster owner=', paymasterOwner)

  // const vpContract = (await ethers.getContractAt('VerifyingPaymaster', verifyingPaymaster.address)).connect(paymasterOwnerSigner)

  // // stake and deposit for the paymaster
  // let tx = await vpContract.addStake(1, {
  //   value: PAYMASTER_STAKE,
  // })
  // await tx.wait()
  // console.log("Paymaster staked")

  // tx = await vpContract.deposit({
  //   value: PAYMASTER_DEPOSIT,
  // })
  // await tx.wait()
  // console.log("Paymaster deposited")
}

export default deployEntryPoint
