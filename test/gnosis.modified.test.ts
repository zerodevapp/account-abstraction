import './aa.init'
import { ethers } from 'hardhat'
import { Signer } from 'ethers'
// import ABIDecoder
import {
  EIP4337Manager,
  EIP4337Manager__factory,
  EIP4337Fallback__factory,
  EntryPoint,
  EntryPoint__factory,
  ModifiedGnosisSafe,
  ModifiedGnosisSafeAccountFactory,
  ModifiedGnosisSafeAccountFactory__factory,
  GnosisSafeProxy,
  GnosisSafeProxyFactory__factory,
  ModifiedGnosisSafe__factory,
  TestCounter,
  TestCounter__factory,
  Proxy__factory,
  SmartWallet__factory,
  SmartWallet
} from '../typechain'
import {
  AddressZero,
  createAddress,
  createAccountOwner,
  deployEntryPoint,
  getBalance,
  HashZero,
  isDeployed
} from './testutils'
import { fillAndSign } from './UserOp'
import { defaultAbiCoder, hexConcat, hexZeroPad, parseEther } from 'ethers/lib/utils'
import { expect } from 'chai'

describe('Modified Gnosis Proxy', function () {
  this.timeout(30000)

  let ethersSigner: Signer
  let safeSingleton: ModifiedGnosisSafe
  let owner: Signer
  let ownerAddress: string
  let proxy: GnosisSafeProxy
  let manager: EIP4337Manager
  let entryPoint: EntryPoint
  let counter: TestCounter
  let proxySafe: ModifiedGnosisSafe
  let safe_execTxCallData: string
  let safe_execFailTxCallData: string

  let accountFactory: ModifiedGnosisSafeAccountFactory

  before('before', async function () {
    // EIP4337Manager fails to compile with solc-coverage
    if (process.env.COVERAGE != null) {
      return this.skip()
    }

    const provider = ethers.provider
    ethersSigner = provider.getSigner()

    entryPoint = await deployEntryPoint()
    // standard safe singleton contract (implementation)
    safeSingleton = await new ModifiedGnosisSafe__factory(ethersSigner).deploy(entryPoint.address)
    // standard safe proxy factory
    const proxyFactory = await new GnosisSafeProxyFactory__factory(ethersSigner).deploy()
    manager = await new EIP4337Manager__factory(ethersSigner).deploy(entryPoint.address)
    owner = createAccountOwner()
    ownerAddress = await owner.getAddress()
    counter = await new TestCounter__factory(ethersSigner).deploy()

    accountFactory = await new ModifiedGnosisSafeAccountFactory__factory(ethersSigner)
      .deploy(ethers.utils.formatBytes32String("MODIFIED-PREFIX"), proxyFactory.address, safeSingleton.address, entryPoint.address)

    const rcpt = await accountFactory.createAccount(ownerAddress, 0).then(async r => r.wait())
    console.log('Deploy gasUsed=', rcpt.gasUsed, rcpt.transactionHash)
    // we use our accountFactory to create and configure the proxy.
    // but the actual deployment is done internally by the gnosis factory
    const ev = await proxyFactory.queryFilter(proxyFactory.filters.ProxyCreation())
    const addr = ev[0].args.proxy

    proxy =
      proxySafe = ModifiedGnosisSafe__factory.connect(addr, owner)

    await ethersSigner.sendTransaction({
      to: proxy.address,
      value: parseEther('0.1')
    })

    const counter_countCallData = counter.interface.encodeFunctionData('count')
    safe_execTxCallData = manager.interface.encodeFunctionData('executeAndRevert', [counter.address, 0, counter_countCallData, 0])

    const counter_countFailCallData = counter.interface.encodeFunctionData('countFail')
    safe_execFailTxCallData = manager.interface.encodeFunctionData('executeAndRevert', [counter.address, 0, counter_countFailCallData, 0])
  })
  let beneficiary: string
  beforeEach(() => {
    beneficiary = createAddress()
  })

  it('should fail from wrong entrypoint', async function () {
    const op = await fillAndSign({
      sender: proxy.address
    }, owner, entryPoint)

    const anotherEntryPoint = await new EntryPoint__factory(ethersSigner).deploy()

    await expect(anotherEntryPoint.handleOps([op], beneficiary)).to.revertedWith('account: not from entrypoint')
  })

  it('should fail on invalid userop', async function () {
    let op = await fillAndSign({
      sender: proxy.address,
      nonce: 1234,
      callGasLimit: 1e6,
      callData: safe_execTxCallData
    }, owner, entryPoint)
    await expect(entryPoint.handleOps([op], beneficiary)).to.revertedWith('account: invalid nonce')

    op = await fillAndSign({
      sender: proxy.address,
      callGasLimit: 1e6,
      callData: safe_execTxCallData
    }, owner, entryPoint)
    // invalidate the signature
    op.callGasLimit = 1
    await expect(entryPoint.handleOps([op], beneficiary)).to.revertedWith('FailedOp(0, "0x0000000000000000000000000000000000000000", "AA24 signature error")')
  })

  it.only('should exec', async function () {
    const op = await fillAndSign({
      sender: proxy.address,
      callGasLimit: 1e6,
      callData: safe_execTxCallData
    }, owner, entryPoint)
    const rcpt = await entryPoint.handleOps([op], beneficiary).then(async r => r.wait())
    console.log('gasUsed=', rcpt.gasUsed, rcpt.transactionHash)

    const ev = rcpt.events!.find(ev => ev.event === 'UserOperationEvent')!
    expect(ev.args!.success).to.eq(true)
    expect(await getBalance(beneficiary)).to.eq(ev.args!.actualGasCost)
  })

  it.only('should revert with reason', async function () {
    await ethersSigner.sendTransaction({
      to: await owner.getAddress(),
      value: parseEther('1')
    })
    const template = await new SmartWallet__factory(ethersSigner).deploy();
    const proxy = await (await ethers.getContractFactory("@biconomy/wallet-contracts/contracts/smart-contract-wallet/Proxy.sol:Proxy")).deploy(template.address);
    const g1 = (await proxy.deployTransaction.wait()).gasUsed
    const handler = await (await ethers.getContractFactory("@biconomy/wallet-contracts/contracts/smart-contract-wallet/handler/DefaultCallbackHandler.sol:DefaultCallbackHandler")).deploy();
    const sender = SmartWallet__factory.connect(proxy.address, ethers.provider);
    const g2 = await sender.connect(owner).init(
      await owner.getAddress(),
      entryPoint.address,
      handler.address
    ).then(async r => r.wait());
    console.log(g1.add(g2.gasUsed));
    const counter_countCallData = counter.interface.encodeFunctionData('count')
    const callData = sender.interface.encodeFunctionData('execFromEntryPoint', [counter.address, 0, counter_countCallData, 0, 1e6]);

    await ethersSigner.sendTransaction({
      to: sender.address,
      value: parseEther('1')
    })
    const op = await fillAndSign({
      sender: sender.address,
      callGasLimit: 1e6,
      callData: callData
    }, owner, entryPoint)
    const log = await sender.callStatic.validateUserOp(op, await entryPoint.getUserOpHash(op), ethers.constants.AddressZero, 0, {from:entryPoint.address});
    console.log(log);
    const rcpt = await entryPoint.handleOps([op], beneficiary).then(async r => r.wait())
    console.log('gasUsed=', rcpt.gasUsed, rcpt.transactionHash)
  })
})
