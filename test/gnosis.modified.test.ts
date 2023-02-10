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
  TestCounter__factory
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

  it('should revert with reason', async function () {
    const op = await fillAndSign({
      sender: proxy.address,
      callGasLimit: 1e6,
      callData: safe_execFailTxCallData
    }, owner, entryPoint)
    const rcpt = await entryPoint.handleOps([op], beneficiary).then(async r => r.wait())
    console.log('gasUsed=', rcpt.gasUsed, rcpt.transactionHash)

    // decode the revertReason
    const ev = rcpt.events!.find(ev => ev.event === 'UserOperationRevertReason')!;
    let message = ev.args!.revertReason
    if (message.startsWith('0x08c379a0')) {
      // Error(string)
      message = defaultAbiCoder.decode(['string'], '0x' + message.substring(10)).toString()
    }
    expect(message).to.eq("count failed")
  })

  let counterfactualAddress: string
  it('should create account', async function () {
    const initCode = hexConcat([
      accountFactory.address,
      accountFactory.interface.encodeFunctionData('createAccount', [ownerAddress, 123])
    ])

    counterfactualAddress = await accountFactory.callStatic.getAddress(ownerAddress, 123)
    expect(!await isDeployed(counterfactualAddress))

    await ethersSigner.sendTransaction({
      to: counterfactualAddress,
      value: parseEther('0.1')
    })
    const op = await fillAndSign({
      sender: counterfactualAddress,
      initCode,
      verificationGasLimit: 400000
    }, owner, entryPoint)

    const rcpt = await entryPoint.handleOps([op], beneficiary).then(async r => r.wait())
    console.log('gasUsed=', rcpt.gasUsed, rcpt.transactionHash)
    expect(await isDeployed(counterfactualAddress))

    const newCode = await ethers.provider.getCode(counterfactualAddress)
    expect(newCode.length).eq(324)

    // createAccount should return the address even when the account has been deployed
    const accountAddress = await accountFactory.callStatic.createAccount(ownerAddress, 123)
    expect(accountAddress).eq(counterfactualAddress)
  })

  it('another op after creation', async function () {
    if (counterfactualAddress == null) this.skip()
    expect(await isDeployed(counterfactualAddress))

    const op = await fillAndSign({
      sender: counterfactualAddress,
      callData: safe_execTxCallData
    }, owner, entryPoint)

    const rcpt = await entryPoint.handleOps([op], beneficiary).then(async r => r.wait())
    console.log('gasUsed=', rcpt.gasUsed, rcpt.transactionHash)
  })

  it('should validate ERC1271 signatures', async function () {
    const safe = EIP4337Fallback__factory.connect(proxySafe.address, ethersSigner)

    const message = ethers.utils.hexlify(ethers.utils.toUtf8Bytes("hello erc1271"))
    const dataHash = ethers.utils.arrayify(ethers.utils.keccak256(message))

    const sig = await owner.signMessage(dataHash)
    expect(await safe.isValidSignature(dataHash, sig)).to.be.eq("0x1626ba7e")

    // make an sig invalid
    const badWallet = ethers.Wallet.createRandom()
    const badSig = await badWallet.signMessage(dataHash)
    expect(await safe.isValidSignature(dataHash, badSig)).to.be.not.eq("0x1626ba7e")
  })

  context('#replaceEIP4337', () => {
    let signature: string
    let newEntryPoint: EntryPoint
    let newFallback: string
    let newManager: EIP4337Manager
    let oldManager: string
    let prev: string

    before(async () => {
      // sig is r{32}s{32}v{1}. for trusting the caller, r=address, v=1
      signature = hexConcat([
        hexZeroPad(ownerAddress, 32),
        HashZero,
        '0x01'])
      newEntryPoint = await new EntryPoint__factory(ethersSigner).deploy()

      newManager = await new EIP4337Manager__factory(ethersSigner).deploy(newEntryPoint.address)
      newFallback = await newManager.eip4337Fallback();
      [prev, oldManager] = await manager.getCurrentEIP4337Manager(proxySafe.address)
    })

    it('should reject to replace if wrong old manager', async () => {
      const replaceManagerCallData = manager.interface.encodeFunctionData('replaceEIP4337Manager',
        [prev, newManager.address, oldManager])
      // using call from module, so it return value..
      const proxyFromModule = proxySafe.connect(entryPoint.address)
      const ret = await proxyFromModule.callStatic.execTransactionFromModuleReturnData(manager.address, 0, replaceManagerCallData, 1)
      const [errorStr] = defaultAbiCoder.decode(['string'], ret.returnData.replace(/0x.{8}/, '0x'))
      expect(errorStr).to.equal('replaceEIP4337Manager: oldManager is not active')
    })

    it('should replace manager', async function () {
      const oldFallback = await manager.eip4337Fallback()
      expect(await proxySafe.isModuleEnabled(entryPoint.address)).to.equal(true)
      expect(await proxySafe.isModuleEnabled(oldFallback)).to.equal(true)

      expect(oldManager.toLowerCase()).to.eq(manager.address.toLowerCase())
      await ethersSigner.sendTransaction({
        to: ownerAddress,
        value: parseEther('0.1')
      })

      const replaceManagerCallData = manager.interface.encodeFunctionData('replaceEIP4337Manager',
        [prev, oldManager, newManager.address])
      await proxySafe.execTransaction(manager.address, 0, replaceManagerCallData, 1, 1e6, 0, 0, AddressZero, AddressZero, signature).then(async r => r.wait())

      expect(await proxySafe.isModuleEnabled(newEntryPoint.address)).to.equal(true)
      expect(await proxySafe.isModuleEnabled(newFallback)).to.equal(true)
      expect(await proxySafe.isModuleEnabled(entryPoint.address)).to.equal(false)
      expect(await proxySafe.isModuleEnabled(oldFallback)).to.equal(false)
    })
  })
})
