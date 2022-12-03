# prometheans-mint-bot

A typescript mint bot for prometheans

## Setup

Requires a websocket provider, NodeJS and yarn

Install dependencies

```
yarn
```

Compile contract types:

```
yarn compile
```

Get help:

```
yarn cli --help
```

## Environment

If you want to set your private key as an `.env` file:

```
cp .env.example .env
```

Add your private key after `PRIVATE_KEY=`. Otherwise you will need to pass it in the command line.

## Example mint one

```
yarn cli mint one --ws ws://localhost:8546 --fee 40 --max-base-fee 30 --monk-rank 11
```

Mint one monk rank 11 (ember 55) using a local node, a max priority fee of 40 gwei, but don't mint if base fee is over 30

```
yarn cli mint one --ws ws://localhost:8546 --fee 40 --max-base-fee 30 --monk-rank 9 --monk-level 3
```

Mint one monk rank 9 level 3 (ember 43) using a local node

## Example mint one with flashbot

```
yarn cli mint one --ws ws://localhost:8546 --fee 40 --max-base-fee 30 --monk-rank 11 --flashbot 0.005
```

Mint one monk rank 11 (ember 55) using a local node, a max priority fee of 40 gwei, but don't mint if base fee is over 30, use a flashbot and tip the validator 0.005 ETH

# Flashbot / safe mint

A contract is provided that will revert if the desired ember level is not achieved. This allows minting by a relay, which will not include the transaction while it reverts, or simply as a way to full send but pay ~1/3 gas costs for a revert. This comes at a cost of an additional 25K gas, making the total mint cost ~100K rather than ~75K.

## Deploy

```
yarn hardhat deploy --network mainnet --tags deploy
yarn hardhat deploy --network mainnet --tags verify
```

This contract has been deployed to:

- mainnet: [0x943d724f8a99c4e3ea233326eca086ce4c5730eb](https://etherscan.io/address/0x943d724f8a99c4e3ea233326eca086ce4c5730eb)
