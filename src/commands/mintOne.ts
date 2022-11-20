import { BigNumber, providers, utils, Signer, Transaction } from "ethers";
import {
  Subject,
  concatMap,
  scan,
  filter,
  partition,
  from,
  tap,
  zip,
} from "rxjs";
import { Prometheans__factory } from "../contracts";
import { toFixedGwei } from "../utils";

const ONE_HUNDRED_GWEI = utils.parseUnits("100", "gwei");

interface IInputSubject {
  currentEmber: BigNumber;
  desiredEmber: number;
}

interface IMintState {
  readonly currentEmber: BigNumber;
  readonly feeData: providers.FeeData;
  readonly status: "minting" | "minted" | "waiting";
}

export async function mintOne({
  desiredEmber,
  signer,
  provider,
  contractAddress,
  maxPriorityFeePerGas,
  maxBaseFeeAllowed,
  watchPending,
}: {
  desiredEmber: number;
  signer: Signer;
  provider: providers.WebSocketProvider;
  contractAddress: string;
  maxPriorityFeePerGas: BigNumber;
  maxBaseFeeAllowed: BigNumber;
  watchPending?: boolean;
}) {
  console.log(`Minting one with ${desiredEmber} ember`);
  const prometheansMinter = Prometheans__factory.connect(
    contractAddress,
    signer
  );
  const prometheansWatcher = Prometheans__factory.connect(
    contractAddress,
    provider
  );

  const blockNumber$ = new Subject<number>();

  const currentEmber$ = blockNumber$.pipe(
    concatMap(() => from(prometheansMinter.currentEmber()))
  );
  const currentGasPrice$ = blockNumber$.pipe(
    concatMap(() => from(provider.getFeeData()))
  );
  const currentEmberAndGasPrice$ = zip(
    blockNumber$,
    currentEmber$,
    currentGasPrice$
  ).pipe(
    tap(([blockNumber, currentEmber, feeData]) => {
      const currentMaxFee = feeData.maxFeePerGas || BigNumber.from(0);
      console.log(
        `Block number: ${blockNumber} current Ember: ${currentEmber.toString()}, Gas Price: ${toFixedGwei(
          currentMaxFee
        )} gwei`
      );
    }),
    filter(([_, currentEmber, feeData]) => {
      return (
        !!feeData.maxFeePerGas &&
        currentEmber.eq(BigNumber.from(desiredEmber).add(1)) &&
        maxBaseFeeAllowed.lte(feeData.maxFeePerGas)
      );
    }),
    scan(
      (state, [_, currentEmber, feeData]) => {
        return state.status === "waiting"
          ? { currentEmber, feeData, status: "minting" as const }
          : state;
      },
      {
        status: "waiting",
        currentEmber: BigNumber.from(0),
        feeData: {} as providers.FeeData,
      } as IMintState
    ),
    filter((state: IMintState) => state.status === "minting"),
    concatMap(({ currentEmber, feeData }) => {
      let { maxFeePerGas, lastBaseFeePerGas } = feeData;
      maxFeePerGas = maxFeePerGas || lastBaseFeePerGas || ONE_HUNDRED_GWEI;
      const totalMaxFeePerGas = maxFeePerGas.add(maxPriorityFeePerGas);
      console.log(
        `Sending transaction with max fee: ${toFixedGwei(
          maxFeePerGas
        )} gwei and max priority fee: ${toFixedGwei(maxPriorityFeePerGas)} gwei`
      );
      return from(
        prometheansMinter.mint({
          gasLimit: mintEstimate.mul(2),
          maxPriorityFeePerGas,
          maxFeePerGas: totalMaxFeePerGas,
        })
      );
    })
  );

  // Make one estimate of a mint call, it shouldn't change much
  const mintEstimate = await prometheansMinter.estimateGas.mint();
  console.log(`Mint estimate: ${mintEstimate.toString()}`);
  const estimatedBaseFee = await provider.getFeeData();
  const estimatedGasCost = utils.formatEther(
    mintEstimate.mul(
      maxPriorityFeePerGas.add(
        estimatedBaseFee.maxFeePerGas || ONE_HUNDRED_GWEI
      )
    )
  );
  console.log(`Estimated gas cost: ${estimatedGasCost.toString()} ether`);
  console.log(
    `Ether left for minting: ${utils.formatEther(
      await signer.getBalance()
    )} at ${await signer.getAddress()}`
  );

  let isMinting = false;
  // Watch each block
  provider.on("block", async (blockNumber) => {
    blockNumber$.next(blockNumber);
  });

  // Also watch the mint events, to see if we are done....
  const newMintEvents = prometheansMinter.filters[
    "Minted(address,uint256,uint256,uint256)"
  ](null, null, null, null);
  const signerAddress = await signer.getAddress();
  prometheansWatcher.on(
    newMintEvents,
    async (minter, tokenId, blockNumber, ember, event) => {
      if (minter === signerAddress) {
        // Get the ember of the minted token
        console.log(
          `Minted tokenId ${tokenId} with ember ${ember} at block ${blockNumber}`
        );
        if (ember.eq(BigNumber.from(desiredEmber))) {
          // This stops everything
          blockNumber$.complete();
          process.exit(0);
        }
      } else {
        const [tx, receipt] = await Promise.all([
          event.getTransaction(),
          event.getTransactionReceipt(),
        ]);
        const maxFeePerGas = tx.maxFeePerGas || BigNumber.from(0);
        const maxPriorityFeePerGas =
          tx.maxPriorityFeePerGas || BigNumber.from(0);
        const transactionCost = receipt.gasUsed.mul(receipt.effectiveGasPrice);

        console.log(
          `Hostile mint detected from ${minter}\b - at block ${blockNumber}\n - with ember ${ember}\n - with max priority fee: ${toFixedGwei(
            maxPriorityFeePerGas
          )} gwei\n - max fee: ${toFixedGwei(
            maxFeePerGas
          )} gwei\n - transaction cost: ${utils.formatEther(
            transactionCost
          )} ether`
        );
      }
    }
  );
  if (watchPending) {
    const prometheusInterface = prometheansWatcher.interface;
    provider.on("pending", async (txHash: string) => {
      try {
        const tx = await provider.getTransaction(txHash);
        // Check if the tx is a mint tx that is not ours
        if (tx?.to === contractAddress && tx?.from !== signerAddress) {
          // Okay, this is a transaction to the contract, but is it a mint?
          const txData = prometheusInterface.parseTransaction({
            data: tx.data,
          });
          console.log(JSON.stringify(txData, null, 2));
          if (txData.name === "mint") {
            const maxFee = tx.maxFeePerGas || BigNumber.from(0);
            const maxPriority = tx.maxPriorityFeePerGas || BigNumber.from(0);
            console.log(
              `Hostile pending transaction detected! From: ${
                tx.from
              }\n - with max fee: ${toFixedGwei(
                maxFee
              )} gwei\n - max priority fee: ${toFixedGwei(maxPriority)} gwei`
            );
          }
        }
      } catch (e) {
        console.error(e);
      }
    });
  }

  currentEmberAndGasPrice$.subscribe({
    complete: () => {
      console.log("Completed");
    },
    error: (err) => {
      console.error(err);
    },
  });
}
