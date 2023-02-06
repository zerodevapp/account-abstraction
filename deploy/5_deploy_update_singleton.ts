import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { DeployFunction } from 'hardhat-deploy/types'

// Expected deterministic address using solidity 0.8.15
const EXPECTED_UPDATE_SINGLETON_ADDRESS = '0x3d4d0cab438cee791b7405cf10448daaa98087c0'

const deployUpdateSingleton: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const from = await hre.ethers.provider.getSigner().getAddress()

  const updateSingleton = await hre.deployments.deploy(
    'UpdateSingleton', {
    from,
    args: [],
    deterministicDeployment: true,
  })

  console.log('==update singleton addr=', updateSingleton.address)

  if (updateSingleton.address.toLowerCase() !== EXPECTED_UPDATE_SINGLETON_ADDRESS) {
    throw new Error(`Expected updateSingleton address ${EXPECTED_UPDATE_SINGLETON_ADDRESS} but got ${updateSingleton.address}`)
  }
}

export default deployUpdateSingleton