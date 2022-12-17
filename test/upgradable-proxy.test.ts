import { ethers } from 'hardhat'
import { Signer } from 'ethers'
import { expect } from 'chai'
import {
  UpgradableProxyFactory,
  UpgradableProxyFactory__factory,
  TestUpgradableCounter,
  TestUpgradableCounter__factory,
  TestUpgradableCounterV2,
  TestUpgradableCounterV2__factory,
} from '../typechain'
import { HashZero } from './testutils'
import { hexlify } from 'ethers/lib/utils'

describe('Upgradable Proxy', () => {
  let ethersSigner: Signer
  let counter: TestUpgradableCounter
  let upgradableProxyFactory: UpgradableProxyFactory
  let proxyCounter: TestUpgradableCounter

  before('set up contracts', async () => {
    ethersSigner = ethers.provider.getSigner()
    upgradableProxyFactory = await new UpgradableProxyFactory__factory(ethersSigner).deploy()
  })

  it('should deploy a proxy', async function () {
    counter = await new TestUpgradableCounter__factory(ethersSigner).deploy()

    // predict the address
    const proxyAddr = await upgradableProxyFactory.callStatic.deploy(counter.address, HashZero)

    expect(await ethers.provider.getCode(proxyAddr)).to.equal('0x')
    await upgradableProxyFactory.deploy(counter.address, HashZero)
    expect(await ethers.provider.getCode(proxyAddr)).to.not.equal('0x')

    proxyCounter = await new TestUpgradableCounter__factory(ethersSigner).attach(proxyAddr)

    await proxyCounter.increment()
    expect(await proxyCounter.counter()).to.equal(1)
  })

  it('another proxy should have separate storage', async () => {
    // use ethers to get a random bytes32 salt
    const salt = ethers.utils.randomBytes(32)

    const anotherProxyAddr = await upgradableProxyFactory.callStatic.deploy(counter.address, salt)
    await upgradableProxyFactory.deploy(counter.address, salt)
    const anotherProxyCounter = await new TestUpgradableCounter__factory(ethersSigner).attach(anotherProxyAddr)

    // this proxy counter should have its own storage, so counter should be 0
    expect(await anotherProxyCounter.counter()).to.equal(0)

    // should be able to increment
    await anotherProxyCounter.increment()
    expect(await anotherProxyCounter.counter()).to.equal(1)
  })

  it('should upgrade implementation', async () => {
    const counter = await new TestUpgradableCounterV2__factory(ethersSigner).deploy()
    await proxyCounter.updateMe(counter.address)

    const proxyCounterV2 = await new TestUpgradableCounterV2__factory(ethersSigner).attach(proxyCounter.address)

    // check that counter is still the same
    expect(await proxyCounterV2.counter()).to.equal(1)

    // test the new decrement function
    await proxyCounterV2.decrement()
    expect(await proxyCounterV2.counter()).to.equal(0)
  })

})

const WALLET_CODE = '0x603a600e3d39601a805130553df3363d3d373d3d3d363d30545af43d82803e903d91601857fd5bf3'

export function addressOf(
  factory: string,
  mainModule: string,
  imageHash: string
): string {
  const codeHash = ethers.utils.keccak256(
    ethers.utils.solidityPack(
      ['bytes', 'bytes32'],
      [WALLET_CODE, ethers.utils.hexZeroPad(mainModule, 32)]
    )
  )

  const hash = ethers.utils.keccak256(
    ethers.utils.solidityPack(
      ['bytes1', 'address', 'bytes32', 'bytes32'],
      ['0xff', factory, imageHash, codeHash]
    )
  )

  return ethers.utils.getAddress(ethers.utils.hexDataSlice(hash, 12))
}
