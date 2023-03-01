import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { DeployFunction } from 'hardhat-deploy/types'

// Addresses are from: https://github.com/safe-global/safe-contracts/blob/821d5fbdc2a4e7776d66c9f232b000b81e60bffc/CHANGELOG.md#version-130-libs0
const PROXY_FACTORY_ADDRESS = '0xa6B71E26C5e0845f74c812102Ca7114b6a896AB2'
const SAFE_SINGLETON = '0x1e41e930174108BA10da4f6851B55e815237D004'
// const PREFIX = 'zerodev'

const deployAccountFactory: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const from = await hre.ethers.provider.getSigner().getAddress()

  const manager = await hre.deployments.get('EIP4337Manager')

  const accountFactory = await hre.deployments.deploy(
    'GnosisSafeAccountFactory', {
      from,
      args: [PROXY_FACTORY_ADDRESS, SAFE_SINGLETON, manager.address],
      deterministicDeployment: true
    })

  console.log('==account factory addr=', accountFactory.address)
}

export default deployAccountFactory
