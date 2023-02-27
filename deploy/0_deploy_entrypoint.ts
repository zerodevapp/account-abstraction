import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { DeployFunction } from 'hardhat-deploy/types'
import { Create2Factory } from '../src/Create2Factory'

const deployEntryPoint: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const from = await hre.ethers.provider.getSigner().getAddress()
  await new Create2Factory(hre.ethers.provider).deployFactory()

  const ret = await hre.deployments.deploy(
    'EntryPoint', {
      from,
      args: [],
      gasLimit: 6e6,
      deterministicDeployment: true
    })
  console.log('==entrypoint addr=', ret.address)
}

export default deployEntryPoint
