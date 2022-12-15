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

describe('Upgradable Proxy', () => {
  let ethersSigner: Signer
  let upgradableProxyFactory: UpgradableProxyFactory
  let proxyCounter: TestUpgradableCounter

  before('set up contracts', async () => {
    ethersSigner = ethers.provider.getSigner()
    upgradableProxyFactory = await new UpgradableProxyFactory__factory(ethersSigner).deploy()
  })

  it('should deploy a proxy', async function () {
    const counter = await new TestUpgradableCounter__factory(ethersSigner).deploy()

    // predict the address
    const proxyAddr = await upgradableProxyFactory.callStatic.deploy(counter.address, HashZero)

    expect(await ethers.provider.getCode(proxyAddr)).to.equal('0x')
    await upgradableProxyFactory.deploy(counter.address, HashZero)
    expect(await ethers.provider.getCode(proxyAddr)).to.not.equal('0x')

    proxyCounter = await new TestUpgradableCounter__factory(ethersSigner).attach(proxyAddr)

    await proxyCounter.increment()
    expect(await proxyCounter.counter()).to.equal(1)
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
