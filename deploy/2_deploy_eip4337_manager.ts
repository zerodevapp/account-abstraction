import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { DeployFunction } from 'hardhat-deploy/types'

const deployEIP4337Manager: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const from = await hre.ethers.provider.getSigner().getAddress()

  const entryPoint = await hre.deployments.get('EntryPoint')

  const manager = await hre.deployments.deploy(
    'EIP4337Manager', {
      from,
      args: [entryPoint.address],
      deterministicDeployment: true
    })
  console.log('==EIP4337Manager addr=', manager.address)
}

export default deployEIP4337Manager
