import {
  BigNumber,
  providers,
  utils,
  providers as ethersProviders,
  Wallet,
} from "ethers";
import {
  FlashbotsBundleProvider,
  FlashbotsBundleResolution,
} from "@flashbots/ethers-provider-bundle";
import {
  Subject,
  concatMap,
  exhaustMap,
  groupBy,
  mergeMap,
  share,
  filter,
  partition,
  from,
  take,
  tap,
  zip,
  of,
} from "rxjs";
import {
  Prometheans__factory,
  PrometheansSafeMint__factory,
} from "../contracts";
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
  flashbots,
  desiredEmber,
  privateKey,
  providers,
  contractAddress,
  safeMintContractAddress,
  maxPriorityFeePerGas,
  maxBaseFeeAllowed,
  watchPending,
  tip,
}: {
  flashbots: boolean;
  desiredEmber: number;
  privateKey: string;
  providers: providers.Provider[];
  contractAddress: string;
  safeMintContractAddress: string;
  maxPriorityFeePerGas: BigNumber;
  maxBaseFeeAllowed: BigNumber;
  watchPending?: boolean;
  tip?: BigNumber;
}) {
  console.log(`Attempting to mint one with ${desiredEmber} ember`);

  const provider = new ethersProviders.FallbackProvider(providers);
  const signer = new Wallet(privateKey, provider);
  const authSigner = Wallet.createRandom();
  // Connected to wallet, used to send transactions
  const prometheansMinter = Prometheans__factory.connect(
    contractAddress,
    signer
  );

  // Connected to provider, used to watch for events
  const prometheansWatcher = Prometheans__factory.connect(
    contractAddress,
    provider
  );

  // Used for flashbot minting
  const prometheansSafeMinter = PrometheansSafeMint__factory.connect(
    safeMintContractAddress,
    provider
  );
  const prometheusSafeMinterInterface =
    PrometheansSafeMint__factory.createInterface();

  // Make one estimate of a mint call, it shouldn't change much
  const mintEstimate = await prometheansMinter.estimateGas.mint();

  // The tip of the observable chain. New blocks are pushed into this subject
  const blockNumber$ = new Subject<number>();

  // Get the latest ember for each block
  const currentEmber$ = blockNumber$.pipe(
    concatMap(() => from(prometheansMinter.currentEmber()))
  );
  // Get the latest gas fee data for each block
  const currentGasPrice$ = blockNumber$.pipe(
    concatMap(() => from(provider.getFeeData()))
  );

  // Combine the latest ember and gas fee data for each block and filter out blocks that contain an ember we are interested in
  const currentEmberAndGasPriceWithDesiredEmber$ = zip(
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
    filter(([_, currentEmber]) =>
      currentEmber.lte(BigNumber.from(desiredEmber).add(1))
    )
  );

  // Split the stream into two streams, one of which is for blocks that are above the max base fee allowed
  const [currentEmberAndGasPriceWellPriced$, tooExpensive$] = partition(
    currentEmberAndGasPriceWithDesiredEmber$.pipe(share()),
    ([_, __, feeData]) =>
      !!feeData.maxFeePerGas && feeData.maxFeePerGas.lte(maxBaseFeeAllowed)
  );

  // We have a block that contains a desired ember and the gas fee is below the max base fee allowed
  //  - We will mint one
  //  - But only if we are not already currently minting
  const currentEmberAndGasPrice$ = currentEmberAndGasPriceWellPriced$.pipe(
    exhaustMap(([blockNumber, __, feeData]) => {
      let { maxFeePerGas, lastBaseFeePerGas } = feeData;
      maxFeePerGas = maxFeePerGas || lastBaseFeePerGas || ONE_HUNDRED_GWEI;
      const totalMaxFeePerGas = maxFeePerGas.add(maxPriorityFeePerGas);

      if (flashbots) {
        return from(
          FlashbotsBundleProvider.create(provider, authSigner).then(
            async (flashbotProvider) => {
              console.log(
                `Sending transaction via flashbot with max fee: ${toFixedGwei(
                  maxFeePerGas as BigNumber
                )} gwei and max priority fee: ${toFixedGwei(
                  maxPriorityFeePerGas
                )} gwei`
              );

              const bundleEstimatedGas =
                await prometheansSafeMinter.estimateGas.mintTo(
                  BigNumber.from(desiredEmber),
                  signerAddress,
                  tip || BigNumber.from(0),
                  {
                    value: tip,
                  }
                );
              const safeMintToTransaction =
                prometheusSafeMinterInterface.encodeFunctionData(
                  "mintTo" as const,
                  [
                    BigNumber.from(desiredEmber),
                    signerAddress,
                    tip || BigNumber.from(0),
                  ]
                );
              const bundle = await flashbotProvider.signBundle([
                {
                  signer,
                  transaction: {
                    to: safeMintContractAddress,
                    data: safeMintToTransaction,
                    maxFeePerGas: totalMaxFeePerGas,
                    maxPriorityFeePerGas,
                    gasLimit: bundleEstimatedGas,
                    chainId: 1,
                    type: 2,
                    value: tip,
                    nonce: await signer.getTransactionCount(),
                  },
                },
              ]);
              console.log("Simulating bundle");
              const simulation = await flashbotProvider.simulate(
                bundle,
                blockNumber + 1
              );
              if ("error" in simulation) {
                console.warn(`Simulation Error: ${simulation.error.message}`);
                throw new Error("Simulation Error");
              } else {
                console.log("Simulation Success");
              }
              console.log(`Sending bundle`);
              const sendRawBundlePromise = flashbotProvider.sendRawBundle(
                bundle,
                blockNumber + 1
              );
              sendRawBundlePromise
                .then((res) => {
                  if ("error" in res) {
                    console.log(`Error sending bundle: ${res.error}`);
                  } else {
                    return res.wait().then(async (resolution) => {
                      switch (resolution) {
                        case FlashbotsBundleResolution.BundleIncluded:
                          console.log(`Bundle included`);
                          break;
                        case FlashbotsBundleResolution.AccountNonceTooHigh:
                          console.log(`Account nonce too high`);
                          break;
                        case FlashbotsBundleResolution.BlockPassedWithoutInclusion:
                          console.log(`Block passed without inclusion`);
                          break;
                      }
                    });
                  }
                })
                .catch((err) => {
                  console.log(`Error sending bundle: ${err}`);
                });
              return sendRawBundlePromise.catch((err) => {
                console.log(`Error sending bundle: ${err}`);
              });
            }
          )
        );
      }

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
      ).pipe(mergeMap((txResponse) => from(txResponse.wait())));
    })
  );

  // Too expensive right now to mint
  tooExpensive$.subscribe({
    next: ([blockNumber]) => {
      console.log(`Too expensive to mint at block ${blockNumber}`);
    },
  });

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
        if (ember.lte(BigNumber.from(desiredEmber))) {
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
          `Hostile mint detected from ${minter}\n - at block ${blockNumber}\n - with ember ${ember}\n - with max priority fee: ${toFixedGwei(
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
    console.log(
      `Watching pending transactions with ${providers.length} providers.....`
    );
    const prometheusInterface = prometheansWatcher.interface;

    const pendingTxHashSubject = new Subject<string>();
    const contractMintTx$ = pendingTxHashSubject.pipe(
      groupBy((txHash) => txHash),
      mergeMap((txGroup$) =>
        txGroup$.pipe(
          take(1),
          mergeMap(async (txHash) => {
            const tx = await provider.getTransaction(txHash);
            // Check if the tx is a mint tx that is not ours
            if (tx?.to === contractAddress && tx?.from !== signerAddress) {
              console.log(`Found pending mint tx: ${txHash}`);
              // Okay, this is a transaction to the contract, but is it a mint?
              const txData = prometheusInterface.parseTransaction({
                data: tx.data,
              });
              console.log(JSON.stringify(txData, null, 2));
              if (txData.name === "mint") {
                const maxFee = tx.maxFeePerGas || BigNumber.from(0);
                const maxPriority =
                  tx.maxPriorityFeePerGas || BigNumber.from(0);
                console.log(
                  `Hostile pending transaction detected! From: ${
                    tx.from
                  }\n - with max fee: ${toFixedGwei(
                    maxFee
                  )} gwei\n - max priority fee: ${toFixedGwei(
                    maxPriority
                  )} gwei`
                );
              }
            }
          })
        )
      )
    );
    for (const provider of providers) {
      provider.on("pending", (txHash) => {
        pendingTxHashSubject.next(txHash);
      });
    }
    contractMintTx$.subscribe({
      error: (err) => {
        console.error(err);
      },
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
