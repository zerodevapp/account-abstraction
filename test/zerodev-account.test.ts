import { ethers } from 'hardhat'
import { expect } from 'chai'
import {
  ZeroDevAccount__factory,
  OwnerPlugin__factory,
  EntryPointRegistry__factory,
  ZeroDevAccount,
  OwnerPlugin
} from '../typechain'
import { parseEther } from 'ethers/lib/utils'
import { Wallet } from 'ethers'
import { fillUserOpDefaults, signUserOp, getUserOpHash } from './UserOp'
import { createAccountOwner } from './testutils'

describe('ZeroDevAccount', function () {
  const ethersSigner = ethers.provider.getSigner()

  let entryPoint: string
  let ethersAccounts: string[]
  let entryPointRegistry: string

  before(async function () {
    ethersAccounts = await ethers.provider.listAccounts()

    // deploy entrypoint registry
    const registry = await new EntryPointRegistry__factory(ethersSigner).deploy()

    // set entrypoint
    entryPoint = ethersAccounts[2]
    await registry.setEntryPoint(entryPoint)
    entryPointRegistry = registry.address
  })

  it('should be able to receive and transfer ETH', async () => {
    const account = await new ZeroDevAccount__factory(ethers.provider.getSigner()).deploy(entryPointRegistry, ethersAccounts[0])
    await ethersSigner.sendTransaction({ from: ethersAccounts[0], to: account.address, value: parseEther('2') })
    await account.transfer(ethersAccounts[2], parseEther('1'))

    const balance = await ethers.provider.getBalance(account.address)
    expect(balance).to.equal(parseEther('1'))
  })

  it('should not be able to transfer ETH if not owner', async () => {
    const account = await new ZeroDevAccount__factory(ethers.provider.getSigner(1)).deploy(entryPointRegistry, ethersAccounts[0])
    await ethersSigner.sendTransaction({ from: ethersAccounts[0], to: account.address, value: parseEther('2') })
    await expect(account.transfer(ethersAccounts[2], parseEther('1')))
      .to.be.revertedWith('only owner')
  })

  it('should be able to register and deregister an owner plugin', async () => {
    const account = await new ZeroDevAccount__factory(ethers.provider.getSigner()).deploy(entryPointRegistry, ethersAccounts[0])
    const plugin = await new OwnerPlugin__factory(ethers.provider.getSigner()).deploy()
    await account.registerPlugin(plugin.address)

    // Check that the plugin is registered by checking the `plugins` mapping
    expect(await account.plugins(plugin.address)).to.equal(true)

    // now test the deregister
    await account.deregisterPlugin(plugin.address)

    // and check that the plugin is no longer registered
    expect(await account.plugins(plugin.address)).to.equal(false)
  })

  describe('validate signatures', () => {
    let account: ZeroDevAccount
    let accountOwner: Wallet

    let plugin: OwnerPlugin
    let pluginOwner: Wallet

    let chainId: number

    before(async () => {
      // create the account and the plugin
      accountOwner = createAccountOwner()
      account = await new ZeroDevAccount__factory(ethers.provider.getSigner(entryPoint)).deploy(entryPointRegistry, accountOwner.address)

      pluginOwner = createAccountOwner()
      plugin = await new OwnerPlugin__factory(ethersSigner).deploy()
      await plugin.transferOwnership(pluginOwner.address)

      // register the plugin
      await account.registerPlugin(plugin.address)

      chainId = await ethers.provider.getNetwork().then(net => net.chainId)
    })

    it('should validate signature of account owner', async () => {
      const userOp = signUserOp(fillUserOpDefaults({
        sender: account.address
      }), accountOwner, entryPoint, chainId)
      const userOpHash = getUserOpHash(userOp, entryPoint, chainId)

      await account.validateUserOp(userOp, userOpHash, entryPoint, 0)
    })

    it('should validate signature of the plugin', async () => {
      const userOp = signUserOp(fillUserOpDefaults({
        sender: account.address,
        nonce: 1
      }), pluginOwner, entryPoint, chainId)
      const userOpHash = getUserOpHash(userOp, entryPoint, chainId)

      // assemble the correct signature by abi encoding the plugin selector, the plugin
      // address, and the user op signature
      const pluginSelector = await account.PLUGIN_SELECTOR()
      const pluginSignature = ethers.utils.defaultAbiCoder.encode(
        ['bytes4', 'address', 'bytes'],
        [pluginSelector, plugin.address, userOp.signature]
      )
      userOp.signature = pluginSignature

      await account.validateUserOp(userOp, userOpHash, entryPoint, 0)
    })

    it('should not validate signature of unregistered plugin', async () => {
      // get a random address
      const unregisteredPluginAddr = Wallet.createRandom().address

      const userOp = signUserOp(fillUserOpDefaults({
        sender: account.address,
        nonce: 2
      }), pluginOwner, entryPoint, chainId)
      const userOpHash = getUserOpHash(userOp, entryPoint, chainId)

      // assemble signature
      const pluginSelector = await account.PLUGIN_SELECTOR()
      const pluginSignature = ethers.utils.defaultAbiCoder.encode(
        ['bytes4', 'address', 'bytes'],
        [pluginSelector, unregisteredPluginAddr, userOp.signature]
      )
      userOp.signature = pluginSignature

      // validate should revert
      await expect(account.validateUserOp(userOp, userOpHash, entryPoint, 0)).to.be.reverted
    })

    it("should not validate signature of plugin after it's deregistered", async () => {
      // deregister the plugin
      await account.deregisterPlugin(plugin.address)

      const userOp = signUserOp(fillUserOpDefaults({
        sender: account.address,
        nonce: 2
      }), pluginOwner, entryPoint, chainId)
      const userOpHash = getUserOpHash(userOp, entryPoint, chainId)

      // assumble signature
      const pluginSelector = await account.PLUGIN_SELECTOR()
      const pluginSignature = ethers.utils.defaultAbiCoder.encode(
        ['bytes4', 'address', 'bytes'],
        [pluginSelector, plugin.address, userOp.signature]
      )
      userOp.signature = pluginSignature

      // validate should revert
      await expect(account.validateUserOp(userOp, userOpHash, entryPoint, 0)).to.be.reverted
    })
  })
})
