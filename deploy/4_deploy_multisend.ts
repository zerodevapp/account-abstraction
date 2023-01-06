import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { DeployFunction } from 'hardhat-deploy/types'

// Expected deterministic address using solidity 0.8.15
const EXPECTED_MULTISEND_ADDRESS = '0x8ae01fcf7c655655ff2c6ef907b8b4718ab4e17c'

const deployAccountFactory: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const from = await hre.ethers.provider.getSigner().getAddress()

  const multisend = await hre.deployments.deploy(
    'MultiSend', {
    from,
    args: [],
    deterministicDeployment: true,
  })

  console.log('==multisend addr=', multisend.address)

  if (multisend.address.toLowerCase() !== EXPECTED_MULTISEND_ADDRESS) {
    throw new Error(`Expected multisend address ${EXPECTED_MULTISEND_ADDRESS} but got ${multisend.address}`)
  }
}

export default deployAccountFactory