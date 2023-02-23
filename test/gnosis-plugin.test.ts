import './aa.init'
import { ethers } from 'hardhat'
import { Signer } from 'ethers'
// import ABIDecoder
import {
  EIP4337DefaultManager,
  EIP4337DefaultManager__factory,
  EIP4337PluginFallback,
  EIP4337PluginFallback__factory,
  EntryPoint,
  EntryPoint__factory,
  GnosisSafe,
  ZerodevPluginAccountFactory,
  ZerodevPluginAccountFactory__factory,
  GnosisSafeProxy,
  GnosisSafeProxyFactory__factory,
  GnosisSafe__factory,
  TestCounter,
  TestCounter__factory,
  EIP4337SessionKeyPlugin,
  EIP4337SessionKeyPlugin__factory
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
import { fillAndSign, fillUserOp, getUserOpHash } from './UserOp'
import { arrayify, defaultAbiCoder, hexConcat, hexZeroPad, parseEther } from 'ethers/lib/utils'
import { expect } from 'chai'
import { UserOperation } from './UserOperation'

describe.only('Zerodev Plugin - Gnosis Proxy', function () {
  this.timeout(30000)

  let ethersSigner: Signer
  let safeSingleton: GnosisSafe
  let owner: Signer
  let ownerAddress: string
  let proxy: GnosisSafeProxy
  let fallback: EIP4337PluginFallback
  let manager: EIP4337DefaultManager
  let sessionKeyPlugin : EIP4337SessionKeyPlugin
  let entryPoint: EntryPoint
  let counter: TestCounter
  let proxySafe: GnosisSafe
  let safe_execTxCallData: string
  let safe_execFailTxCallData: string

  let accountFactory: ZerodevPluginAccountFactory

  before('before', async function () {
    // EIP4337Manager fails to compile with solc-coverage
    if (process.env.COVERAGE != null) {
      return this.skip()
    }

    const provider = ethers.provider
    ethersSigner = provider.getSigner()

    // standard safe singleton contract (implementation)
    safeSingleton = await new GnosisSafe__factory(ethersSigner).deploy()
    // standard safe proxy factory
    const proxyFactory = await new GnosisSafeProxyFactory__factory(ethersSigner).deploy()
    entryPoint = await deployEntryPoint()
    fallback = await new EIP4337PluginFallback__factory(ethersSigner).deploy(entryPoint.address)
    manager = await new EIP4337DefaultManager__factory(ethersSigner).deploy(entryPoint.address, fallback.address)
    sessionKeyPlugin = await new EIP4337SessionKeyPlugin__factory(ethersSigner).deploy(entryPoint.address, fallback.address);
    owner = createAccountOwner()
    ownerAddress = await owner.getAddress()
    counter = await new TestCounter__factory(ethersSigner).deploy()

    accountFactory = await new ZerodevPluginAccountFactory__factory(ethersSigner)
      .deploy(ethers.utils.formatBytes32String("PREFIX"), proxyFactory.address, safeSingleton.address, manager.address)

    await accountFactory.createAccount(ownerAddress, 0)
    // we use our accountFactory to create and configure the proxy.
    // but the actual deployment is done internally by the gnosis factory
    const ev = await proxyFactory.queryFilter(proxyFactory.filters.ProxyCreation())
    const addr = ev[0].args.proxy

    proxy =
      proxySafe = GnosisSafe__factory.connect(addr, owner)

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
  describe('vanila', async function(){
    it('should exec', async function () {
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
  })


  describe('session key', async function(){
    let sessionKey : Signer;
    let userSignedUserOp : UserOperation;
    beforeEach(async function() {
        sessionKey = createAccountOwner(); // use random session key
        let userOp = {
          sender: proxy.address,
          callGasLimit: 1e6,
          callData: safe_execTxCallData,
          verificationGasLimit: 1e6,
        }
        userSignedUserOp = await signSessionKey(
          owner,
          fallback,
          userOp,
          1777068462,
          0,
          sessionKeyPlugin,
          sessionKey,
          entryPoint
        );
        // fund wallet some eth for gas
        await ethersSigner.sendTransaction({
          to: proxy.address,
          value: parseEther('10')
        });
    });

    it("should exec", async function() {
      const signedUserOp = await signUserOpWithSessionKey(
        userSignedUserOp,
        sessionKey,
        sessionKeyPlugin,
        entryPoint
      );

      const count_before = await counter.counters(proxy.address);
      const nonce_before = await getSessionNonce(sessionKeyPlugin, proxy.address, sessionKey);
      const rcpt = await entryPoint.handleOps([signedUserOp], beneficiary).then(async r => r.wait())
      const ev = rcpt.events!.find(ev => ev.event === 'UserOperationEvent')!
      expect(ev.args!.success).to.eq(true)
      expect(await counter.counters(proxy.address)).to.eq(count_before.add(1));
      const nonce_after = await getSessionNonce(sessionKeyPlugin, proxy.address, sessionKey);
      expect(nonce_after).to.be.eq(ethers.BigNumber.from(nonce_before).add(1));
    });
    it("should be able to exec multiple times with same user signature", async function() {
      let signedUserOp = await signUserOpWithSessionKey(
        userSignedUserOp,
        sessionKey,
        sessionKeyPlugin,
        entryPoint
      );

      let count_before = await counter.counters(proxy.address);
      let nonce_before = await getSessionNonce(sessionKeyPlugin, proxy.address, sessionKey);
      let rcpt = await entryPoint.handleOps([signedUserOp], beneficiary).then(async r => r.wait())
      let ev = rcpt.events!.find(ev => ev.event === 'UserOperationEvent')!
      expect(ev.args!.success).to.eq(true)
      expect(await counter.counters(proxy.address)).to.eq(count_before.add(1));
      let nonce_after = await getSessionNonce(sessionKeyPlugin, proxy.address, sessionKey);
      expect(nonce_after).to.be.eq(ethers.BigNumber.from(nonce_before).add(1));

      signedUserOp = await signUserOpWithSessionKey(
        userSignedUserOp,
        sessionKey,
        sessionKeyPlugin,
        entryPoint
      );

      count_before = await counter.counters(proxy.address);
      nonce_before = await getSessionNonce(sessionKeyPlugin, proxy.address, sessionKey);
      rcpt = await entryPoint.handleOps([signedUserOp], beneficiary).then(async r => r.wait())
      ev = rcpt.events!.find(ev => ev.event === 'UserOperationEvent')!
      expect(ev.args!.success).to.eq(true)
      expect(await counter.counters(proxy.address)).to.eq(count_before.add(1));
      nonce_after = await getSessionNonce(sessionKeyPlugin, proxy.address, sessionKey);
      expect(nonce_after).to.be.eq(ethers.BigNumber.from(nonce_before).add(1));
    });
  })
})

async function getSessionNonce(
  plugin : EIP4337SessionKeyPlugin,
  sender : string,
  sessionKey : Signer
) : Promise<number> {
  return await EIP4337PluginFallback__factory.connect(sender, plugin.provider).callStatic
  .queryPlugin(plugin.address, plugin.interface.encodeFunctionData('sessionNonce', [await sessionKey.getAddress()])).catch(e => {
    if(e.errorName !== "QueryResult") {
      throw e;
    }
    return e.errorArgs.result;
  });
}

async function signSessionKey(
  owner : Signer,
  fallback : EIP4337PluginFallback,
  userOp : Partial<UserOperation>,
  validUntil: number,
  validAfter:number,
  plugin : EIP4337SessionKeyPlugin,
  sessionKey : Signer,
  entryPoint?: EntryPoint
) : Promise<UserOperation> {
  const op = await fillAndSign(userOp, owner, entryPoint)
  const provider = entryPoint?.provider
  const domain = {
    name : "EIP4337PluginFallback",
    version: "1.0.0",
    verifyingContract: fallback.address,
    chainId: (await provider!.getNetwork()).chainId
  }
  const value = {
    sender : userOp.sender,
    validUntil : validUntil,
    validAfter : validAfter,
    plugin : plugin.address,
    data : hexZeroPad(await sessionKey.getAddress(), 20)
  }
  const userSig = await owner._signTypedData(
      domain,
      {
        "ValidateUserOpPlugin" : [
          {name: "sender", type: "address"},
          {name: "validUntil", type: "uint48"},
          {name: "validAfter", type: "uint48"},
          {name: "plugin", type: "address"},
          {name: "data", type: "bytes"}
        ]
      },
      value
  );

  const signature = hexConcat([
    hexZeroPad(plugin.address, 20),
    hexZeroPad(validUntil, 6),
    hexZeroPad(validAfter, 6),
    userSig,
  ]);
  return {
    ...op,
    nonce : 0,
    signature : signature
  };
}

async function signUserOpWithSessionKey(
  userOp : UserOperation,
  sessionKey : Signer,
  plugin : EIP4337SessionKeyPlugin,
  entryPoint?: EntryPoint
): Promise<UserOperation> {
  let op = await fillUserOp(userOp, entryPoint);
  const provider = entryPoint?.provider;
  const chainId = await provider!.getNetwork().then(net => net.chainId);
  const opHash = await getUserOpHash(op, entryPoint!.address, chainId);
  const sessionDomain = {
    name : "EIP4337SessionKeyPlugin",
    version: "1.0.0",
    verifyingContract: userOp.sender,
    chainId: chainId
  };

  const nonce = await getSessionNonce(plugin, userOp.sender!, sessionKey);
  const sessionKeySig = await sessionKey._signTypedData(
    sessionDomain,
    {
      "Session" : [
        {name: "userOpHash", type: "bytes32"},
        {name: "nonce", type: "uint256"},
      ]
    },
    {
      userOpHash : opHash,
      nonce : nonce //await plugin.sessionNonce(await sessionKey.getAddress())
    }
  );

  return {
    ...op,
    signature : hexConcat([
      op.signature,
      ethers.utils.defaultAbiCoder.encode(["bytes","bytes"], [await sessionKey.getAddress(), sessionKeySig])
    ])
  };
}