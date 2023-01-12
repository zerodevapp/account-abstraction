import { ethers } from 'ethers'
import hre from 'hardhat'

// 30gwei
const gasPrice = ethers.utils.parseUnits('30', 'gwei')

async function main() {
  const signer = hre.ethers.provider.getSigner()
  const { paymasterOwner: sender } = (await hre.getNamedAccounts())
  const senderSigner = hre.ethers.provider.getSigner(sender)

  const module = await hre.deployments.get('ERC721SubscriptionModule')
  const moduleContract = (await hre.ethers.getContractAt('ERC721SubscriptionModule', module.address)).connect(signer)

  const nft = await hre.deployments.get('SampleNFT')
  const nftContract = (await hre.ethers.getContractAt('SampleNFT', nft.address)).connect(signer)

  const tokenId = 7

  // mint an NFT to sender
  console.log('minting NFT')
  let tx = await nftContract.mint(senderSigner.getAddress(), tokenId, {
    gasPrice,
  })
  await tx.wait()

  // approve the NFT for transfer
  console.log('approving NFT')
  tx = await nftContract.connect(senderSigner).approve(module.address, tokenId, {
    gasPrice,
  })
  await tx.wait()

  console.log('triggering payment')
  tx = await moduleContract.triggerPayment(tokenId, {
    gasPrice,
    gasLimit: 1000000,
  })
  await tx.wait()

  console.log("Payment triggered")
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
