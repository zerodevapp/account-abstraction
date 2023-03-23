import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { DeployFunction } from 'hardhat-deploy/types'
import { ethers } from 'hardhat'

const ENTRYPOINT_ADDR = '0x0576a174D229E3cFA37253523E645A78A0C91B57'

const deploySimpleAccountFactory: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const provider = ethers.provider
  const from = await provider.getSigner().getAddress()

  const ret = await hre.deployments.deploy(
    'SimpleAccountFactory', {
    from,
    args: [ENTRYPOINT_ADDR],
    gasLimit: 6e6,
    deterministicDeployment: true
  })
  console.log('==SimpleAccountFactory addr=', ret.address)
}

export default deploySimpleAccountFactory
