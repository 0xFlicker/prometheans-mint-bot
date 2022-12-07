import { Command } from "commander";
import "dotenv/config";

import { Wallet, providers, BigNumber, utils } from "ethers";

import { mintOne } from "./commands/mintOne";
import { rankToEmber } from "./utils";

const program = new Command();

program.version("0.0.1");

const mintCommand = program.command("mint");

mintCommand
  .command("one")
  .option("-p, --private-key <privateKey>", "private key")
  .option("-w, --ws <ws>", "ws url")
  .option(
    "-m, --max-base-fee <maxBaseFee>",
    "do not mint if base fee is higher than this",
    (num) => utils.parseUnits(num, "gwei")
  )
  .option("-f, --fee <fee>", "max priority fee per gas", (fee) =>
    utils.parseUnits(fee, "gwei")
  )
  .option(
    "-m, --monk-rank <monkRank>",
    "desired monk rank (1-15) with 1 being the highest",
    (num: string) => parseInt(num, 10)
  )
  .option(
    "-l, --monk-level <monkLevel>",
    "desired monk level (1-5)",
    (num: string) => parseInt(num, 10),
    1
  )
  .option("--watch-pending", "watch pending transactions")
  .option("-t, --flashbot <tip>", "use flashbots and tip", (num) =>
    utils.parseEther(num)
  )
  .action(
    async ({
      flashbot,
      privateKey,
      ws,
      monkRank,
      monkLevel,
      fee,
      maxBaseFee,
      watchPending,
    }) => {
      privateKey = privateKey || process.env.PRIVATE_KEY;
      const ember = rankToEmber(monkRank, monkLevel);
      let allProviders: providers.Provider[];
      if (ws.includes(",")) {
        const urls: string[] = ws.split(",");
        allProviders = urls.map((url) => new providers.WebSocketProvider(url));
      } else {
        allProviders = [new providers.WebSocketProvider(ws)];
      }
      maxBaseFee = maxBaseFee || utils.parseUnits("30", "gwei");

      await mintOne({
        desiredEmber: ember,
        privateKey,
        providers: allProviders,
        contractAddress: "0xc4a5025c4563ad0acc09d92c2506e6744dad58eb",
        safeMintContractAddress: "0x943d724f8a99c4e3ea233326eca086ce4c5730eb",
        maxPriorityFeePerGas: fee,
        maxBaseFeeAllowed: maxBaseFee,
        watchPending,
        flashbots: !!flashbot,
        tip: flashbot ?? undefined,
      });
    }
  );

program.parse(process.argv);
