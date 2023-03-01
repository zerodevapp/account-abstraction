import hre, { ethers } from 'hardhat'

const PAYMASTER_DEPOSIT = ethers.utils.parseEther('0.5')
const PAYMASTER_ADDRESS = '0x95341fe310FcDcA0d08c7b263773963ff4Bc3439'

const main = async function (): Promise<void> {
  const signer = hre.ethers.provider.getSigner()
  const paymasterContract = (await hre.ethers.getContractAt('VerifyingPaymaster', PAYMASTER_ADDRESS)).connect(signer)
  const tx = await paymasterContract.deposit({ value: PAYMASTER_DEPOSIT })
  await tx.wait()
  console.log('Paymaster deposited')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
