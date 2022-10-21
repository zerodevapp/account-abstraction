import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { DeployFunction } from 'hardhat-deploy/types'
import { Create2Factory } from '../src/Create2Factory'
import { ethers, hardhatArguments } from 'hardhat'

const UNSTAKE_DELAY_SEC = 86400
const PAYMASTER_STAKE = ethers.utils.parseEther('1')

const deployEntryPoint: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const provider = ethers.provider
  const from = await provider.getSigner().getAddress()
  await new Create2Factory(ethers.provider).deployFactory()

  const entryPoint = await hre.deployments.deploy(
    'EntryPoint',
    {
      from,
      args: [PAYMASTER_STAKE, UNSTAKE_DELAY_SEC],
      deterministicDeployment: true
    })
  console.log('==EntryPoint addr=', entryPoint.address)

  const simpleWalletDeployer = await hre.deployments.deploy(
    'SimpleWalletDeployer',
    {
      from,
      deterministicDeployment: true
    })
  console.log('==SimpleWalletDeployer addr=', simpleWalletDeployer.address)

  const { paymasterOwner } = (await hre.getNamedAccounts())
  const paymasterOwnerSigner = await ethers.getSigner(paymasterOwner)

  const verifyingPaymaster = await hre.deployments.deploy(
    'VerifyingPaymaster',
    {
      from: paymasterOwner,
      args: [entryPoint.address, paymasterOwner],
    })
  console.log('==VerifyingPaymaster addr=', verifyingPaymaster.address)
  console.log('==VerifyingPaymaster owner=', paymasterOwner)

  const vpContract = (await ethers.getContractAt('VerifyingPaymaster', verifyingPaymaster.address)).connect(paymasterOwnerSigner)

  // stake and deposit for the paymaster
  let tx = await vpContract.addStake(0, {
    value: PAYMASTER_STAKE,
  })
  await tx.wait()

  tx = await vpContract.deposit({
    value: PAYMASTER_STAKE,
  })
  await tx.wait()

  const testToken = await hre.deployments.deploy(
    'TestToken',
    {
      from,
      args: [0],
    })
  console.log('==TestToken addr=', testToken.address)
}

export default deployEntryPoint
