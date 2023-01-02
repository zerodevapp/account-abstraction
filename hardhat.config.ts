import '@nomiclabs/hardhat-waffle'
import '@typechain/hardhat'
import { HardhatUserConfig } from 'hardhat/config'
import 'hardhat-deploy'
import '@nomiclabs/hardhat-etherscan'

import 'solidity-coverage'

import * as fs from 'fs'

import * as dotenv from 'dotenv'
dotenv.config()

const mnemonicFileName = process.env.MNEMONIC_FILE ?? `${process.env.HOME}/.secret/testnet-mnemonic.txt`
let mnemonic = 'test '.repeat(11) + 'junk'
if (fs.existsSync(mnemonicFileName)) { mnemonic = fs.readFileSync(mnemonicFileName, 'ascii') }

function getNetwork1(url: string): { url: string, accounts: { mnemonic: string } } {
  return {
    url,
    accounts: { mnemonic }
  }
}

function getNetwork(name: string): { url: string, accounts: { mnemonic: string } } {
  return getNetwork1(`https://${name}.infura.io/v3/${process.env.INFURA_ID}`)
  // return getNetwork1(`wss://${name}.infura.io/ws/v3/${process.env.INFURA_ID}`)
}

const optimizedComilerSettings = {
  version: '0.8.17',
  settings: {
    optimizer: { enabled: true, runs: 1000000 },
    viaIR: true
  }
}

// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more

const config: HardhatUserConfig = {
  solidity: {
    compilers: [{
      version: '0.8.15',
      settings: {
        optimizer: { enabled: true, runs: 1000000 }
      }
    }],
    overrides: {
      'contracts/core/EntryPoint.sol': optimizedComilerSettings,
      'contracts/samples/SimpleWallet.sol': optimizedComilerSettings
    }
  },
  networks: {
    dev: { url: 'http://localhost:8545' },
    // github action starts localgeth service, for gas calculations
    localgeth: { url: 'http://localgeth:8545' },
    proxy: getNetwork1('http://localhost:8545'),
    kovan: getNetwork('kovan'),
    mumbai: {
      url: `https://polygon-mumbai.infura.io/v3/${process.env.INFURA_ID}`,
      accounts: [process.env.DEPLOYER_PRIVATE_KEY!, process.env.MUMBAI_PAYMASTER_OWNER_PRIVATE_KEY!],
    },
    polygon: {
      url: `https://polygon-mainnet.infura.io/v3/${process.env.INFURA_ID}`,
      accounts: [process.env.DEPLOYER_PRIVATE_KEY!],
    },
    mainnet: {
      url: `https://mainnet.infura.io/v3/${process.env.INFURA_ID}`,
      accounts: [process.env.DEPLOYER_PRIVATE_KEY!, process.env.MUMBAI_PAYMASTER_OWNER_PRIVATE_KEY!],
    },
    goerli: {
      url: `https://goerli.infura.io/v3/${process.env.INFURA_ID}`,
      accounts: [process.env.DEPLOYER_PRIVATE_KEY!, process.env.MUMBAI_PAYMASTER_OWNER_PRIVATE_KEY!],
    },
    fuji: {
      url: `https://avalanche-fuji.infura.io/v3/${process.env.INFURA_ID}`,
      accounts: [process.env.DEPLOYER_PRIVATE_KEY!, process.env.MUMBAI_PAYMASTER_OWNER_PRIVATE_KEY!],
    },
    avalanche: {
      url: `https://avalanche-mainnet.infura.io/v3/${process.env.INFURA_ID}`,
      accounts: [process.env.DEPLOYER_PRIVATE_KEY!, process.env.MUMBAI_PAYMASTER_OWNER_PRIVATE_KEY!],
    },
  },
  namedAccounts: {
    paymasterOwner: {
      default: 1,
      // default: `privatekey://${process.env.MUMBAI_PAYMASTER_OWNER_PRIVATE_KEY!}`,
    }
  },
  mocha: {
    timeout: 10000
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY
  }
}

// coverage chokes on the "compilers" settings
if (process.env.COVERAGE != null) {
  // @ts-ignore
  config.solidity = config.solidity.compilers[0]
}

export default config
