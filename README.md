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
