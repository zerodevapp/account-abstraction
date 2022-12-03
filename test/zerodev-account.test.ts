import { Wallet } from 'ethers'
import { ethers } from 'hardhat'
import { expect } from 'chai'
import {
  ZeroDevAccount,
  ZeroDevAccount__factory,
  OwnerPlugin,
  OwnerPlugin__factory,
} from '../typechain'
import { parseEther } from 'ethers/lib/utils'

describe('ZeroDevAccount', function () {
  const entryPoint = '0x'.padEnd(42, '2')
  const ethersSigner = ethers.provider.getSigner()
  let ethersAccounts: string[]

  before(async function () {
    ethersAccounts = await ethers.provider.listAccounts()
  })

  it('should be able to receive and transfer ETH', async () => {
    const account = await new ZeroDevAccount__factory(ethers.provider.getSigner()).deploy(ethersAccounts[0])
    await ethersSigner.sendTransaction({ from: ethersAccounts[0], to: account.address, value: parseEther('2') })
    await account.transfer(ethersAccounts[2], parseEther('1'))

    const balance = await ethers.provider.getBalance(account.address)
    expect(balance).to.equal(parseEther('1'))
  })
})
