import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { DeployFunction } from 'hardhat-deploy/types'
import { ethers } from 'ethers'

const ownerAddr = '0x56860862E9d391aAa53Cff0F6A2f952452c3748a'
const price = ethers.utils.parseEther('0.01')
const period = 60 // seconds

const deploySampleModule: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const from = await hre.ethers.provider.getSigner().getAddress()
  const { paymasterOwner: sender } = (await hre.getNamedAccounts())

  const sampleNFT = await hre.deployments.deploy(
    'SampleNFT', {
    from,
    args: [],
    deterministicDeployment: true,
  })
  console.log('==sample NFT addr=', sampleNFT.address)

  const module = await hre.deployments.deploy(
    'ERC721SubscriptionModule', {
    from,
    args: [ownerAddr, sampleNFT.address, sender, price, period],
    deterministicDeployment: true,
  })
  console.log('==sample module addr=', module.address)
}

export default deploySampleModule