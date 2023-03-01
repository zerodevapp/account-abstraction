import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { DeployFunction } from 'hardhat-deploy/types'
import { ethers } from 'hardhat'

const PAYMASTER_DEPOSIT = ethers.utils.parseEther('0.2')

const deployPaymaster: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const signer = hre.ethers.provider.getSigner()
  const from = await signer.getAddress()
  const { paymasterOwner } = (await hre.getNamedAccounts())

  const entryPoint = await hre.deployments.get('EntryPoint')

  // Only the owner of the paymaster contract can deposit stake, and since
  // we use deterministic deployment, the owner will be some inaccessible address.
  // However, this doesn't matter because our paymaster does not access global
  // storage and therefore does not need to be staked.
  const paymaster = await hre.deployments.deploy(
    'VerifyingPaymaster', {
      from,
      args: [entryPoint.address, paymasterOwner],
      deterministicDeployment: true
    })
  console.log('==paymaster addr=', paymaster.address)

  const paymasterContract = (await hre.ethers.getContractAt('VerifyingPaymaster', paymaster.address)).connect(signer)
  const tx = await paymasterContract.deposit({ value: PAYMASTER_DEPOSIT })
  await tx.wait()
  console.log('Paymaster deposited')
}

export default deployPaymaster
