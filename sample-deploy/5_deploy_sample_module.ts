import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { DeployFunction } from 'hardhat-deploy/types'
import { ethers } from 'ethers'

// the sender we use in demo
const SENDER = '0x4F7810B609035Fa48D535A39B69ab82E6E83dC5A'
const price = ethers.utils.parseEther('0.01')
const period = 60 // seconds

const deploySampleModule: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const from = await hre.ethers.provider.getSigner().getAddress()

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
    args: [sampleNFT.address, SENDER, price, period],
    deterministicDeployment: true,
  })
  console.log('==sample module addr=', module.address)
}

export default deploySampleModule