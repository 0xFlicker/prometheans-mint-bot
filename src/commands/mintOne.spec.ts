import { Subject, concatMap, scan, filter, zip, share, takeLast } from "rxjs";
import { BigNumber, utils } from "ethers";

const ONE_HUNDRED_GWEI = utils.parseUnits("100", "gwei");

describe("#mintOne", () => {
  it("gets latest current ember and gas fee", (done) => {
    const testSubject$ = new Subject<number>();

    const gasFee$ = testSubject$.pipe(
      share(),
      concatMap((blockNumber) => {
        return new Promise<BigNumber>((resolve) => {
          setTimeout(() => {
            resolve(ONE_HUNDRED_GWEI.add(blockNumber));
          }, 100);
        });
      })
    );
    const currentEmber$ = testSubject$.pipe(
      share(),
      concatMap((blockNumber) => {
        return new Promise<BigNumber>((resolve) => {
          setTimeout(() => {
            resolve(BigNumber.from(75 - blockNumber));
          }, 200);
        });
      })
    );
    const emberAndGasFee$ = zip(gasFee$, currentEmber$).pipe(takeLast(1));
    emberAndGasFee$.subscribe({
      next: ([gasFee, currentEmber]) => {
        expect(gasFee).toEqual(ONE_HUNDRED_GWEI.add(2));
        expect(currentEmber).toEqual(BigNumber.from(75 - 2));
        done();
      },
      error: (err) => {
        done(err);
      },
    });
    testSubject$.next(1);
    testSubject$.next(2);
    testSubject$.complete();
  });
});
