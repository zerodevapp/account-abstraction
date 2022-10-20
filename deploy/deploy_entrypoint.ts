import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { DeployFunction } from 'hardhat-deploy/types'
import { Create2Factory } from '../src/Create2Factory'
import { ethers } from 'hardhat'
import { Wallet } from 'ethers'
import {
  VerifyingPaymaster__factory
} from '../typechain'

const UNSTAKE_DELAY_SEC = 86400
const PAYMASTER_STAKE = ethers.utils.parseEther('1')

const deployEntryPoint: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const provider = ethers.provider
  const signer = provider.getSigner()

  const from = await signer.getAddress()
  console.log('from:', from)
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

  // This is just the third account of `yarn hardhat-node`
  // just for testing purposes
  const verifyingSigner = new Wallet('0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6', provider)
  console.log(verifyingSigner.address)
  const p = (await hre.deployments.deploy('VerifyingPaymaster', {
    from: verifyingSigner.address,
    args: [ret.address, verifyingSigner.address],
    // deterministicDeployment: true,
  }))

  // const paymasterFactory = hre.ethers.getContractFactoryFromArtifact('VerifyingPaymaster')
  const paymaster = (await hre.ethers.getContractAt('VerifyingPaymaster', p.address)).connect(verifyingSigner)
  // const paymaster = await new VerifyingPaymaster__factory(signer).deploy(ret.address, verifyingSigner.address)
  console.log('==paymaster=', paymaster.address)
  console.log('paymaster signer:', await paymaster.verifyingSigner())
  console.log('paymaster owner:', await paymaster.owner())

  // stake and deposit for the paymaster
  let tx = await paymaster.addStake(0, {
    value: PAYMASTER_STAKE,
  })
  await tx.wait()

  tx = await paymaster.deposit({
    value: PAYMASTER_STAKE,
  })
  await tx.wait()

  // Send ETH to the user-- just for testing
  // tx = await signer.sendTransaction({
  //   to: "0x14D9c1D4E71DAc2Ed19f5d4BE17d282DFA582399",
  //   value: ethers.utils.parseEther("1.0")
  // })
  // await tx.wait()

}

export default deployEntryPoint
