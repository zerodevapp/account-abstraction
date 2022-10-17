import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { DeployFunction } from 'hardhat-deploy/types'
import { Create2Factory } from '../src/Create2Factory'
import { ethers } from 'hardhat'

const UNSTAKE_DELAY_SEC = 86400
const PAYMASTER_STAKE = ethers.utils.parseEther('1')

const deployEntryPoint: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const provider = ethers.provider
  const signer = provider.getSigner()

  // Send ETH to the user -- just for testing
  const tx = await signer.sendTransaction({
    to: "0xCD0b873c2f8f6e34dda075F82C73567712ed28DE",
    value: ethers.utils.parseEther("1.0")
  })
  await tx.wait()

  const from = await signer.getAddress()
  await new Create2Factory(ethers.provider).deployFactory()

  const ret = await hre.deployments.deploy(
    'EntryPoint', {
    from,
    args: [PAYMASTER_STAKE, UNSTAKE_DELAY_SEC],
    gasLimit: 4e6,
    deterministicDeployment: true
  })
  console.log('==entrypoint addr=', ret.address)
  // const entryPointAddress = ret.address

  const s = await hre.deployments.deploy(
    'SimpleWalletDeployer', {
    from,
    deterministicDeployment: true
  })

  console.log('== wallet deployer =', s.address)

  // const t = await hre.deployments.deploy('TestCounter', {
  //   from,
  //   deterministicDeployment: true
  // })
  // console.log('==testCounter=', t.address)

  const t = await hre.deployments.deploy('TestToken', {
    from,
    deterministicDeployment: true
  })
  console.log('==testToken=', t.address)
}

export default deployEntryPoint
