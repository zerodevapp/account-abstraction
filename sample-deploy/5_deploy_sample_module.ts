import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { DeployFunction } from 'hardhat-deploy/types'
import { ethers } from 'ethers'

// the sender we use in demo
const SENDER = '0x4c10a098b428EE91e6ebBDDE89427E6D45B32A7D'
const price = ethers.utils.parseEther('0.01')
const period = 60 // seconds

const deploySampleModule: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const from = await hre.ethers.provider.getSigner().getAddress()

  const sampleNFT = await hre.deployments.deploy(
    'SampleNFT', {
      from,
      args: [],
      deterministicDeployment: true
    })
  console.log('==sample NFT addr=', sampleNFT.address)

  const module = await hre.deployments.deploy(
    'ERC721SubscriptionModule', {
      from,
      args: [sampleNFT.address, SENDER, price, period],
      deterministicDeployment: true
    })
  console.log('==sample module addr=', module.address)
}

export default deploySampleModule
