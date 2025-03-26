import { err, ok, Result } from "neverthrow";
import { map, Observable, of, switchMap, type UnaryFunction } from "rxjs";

type Prettify<T> = {
  [K in keyof T]: T[K];
} & {};

export function mapResult<T, U, E>(
  project: (v: T) => U,
): UnaryFunction<Observable<Result<T, E>>, Observable<Result<U, E>>> {
  return map((r) => r.map(project));
}

export function switchMapResult<T, U, E1 = Error, E2 = Error>(
  project: (v: T) => Observable<Result<U, E2>>,
): UnaryFunction<Observable<Result<T, E1>>, Observable<Result<U, E1 | E2>>> {
  return switchMap((r) => {
    if (r.isOk()) {
      return project(r.value);
    } else {
      return of(err(r.error));
    }
  });
}

type ExtractErrFromRecordSource<
  T extends Record<string, Observable<Result<any, any>>>,
> = T[keyof T] extends Observable<Result<any, infer E>> ? E : never;
type ExtractOkFromRecordSource<
  T extends Record<string, Observable<Result<any, any>>>,
> = {
  [Key in keyof T]: T[Key] extends Observable<Result<infer O, any>> ? O : never;
};
type ExtractErrFromArraySource<T extends Observable<Result<any, any>>[]> =
  T[number] extends Observable<Result<any, infer E>> ? E : never;
type ExtractOkFromArraySource<T extends Observable<Result<any, any>>[]> =
  T[number] extends Observable<Result<infer O, any>> ? O[] : never;

export function forkJoinResult<
  T extends Record<string, Observable<Result<any, any>>>,
>(
  sources: T,
): Observable<
  Result<Prettify<ExtractOkFromRecordSource<T>>, ExtractErrFromRecordSource<T>>
>;
export function forkJoinResult<T extends Observable<Result<any, any>>[]>(
  sources: T,
): Observable<
  Result<ExtractOkFromArraySource<T>, ExtractErrFromArraySource<T>>
>;
export function forkJoinResult<T>(sources: T): any {
  const entries = Object.entries(sources as any) as [
    string,
    Observable<Result<any, any>>,
  ][];

  const isArray = Array.isArray(sources);

  return new Observable((subscriber) => {
    const acc: Record<string, any> = isArray ? [] : {};

    let pending = entries.length;

    // handle empty object
    if (pending === 0) {
      subscriber.next(ok(acc));
      subscriber.complete();
      return;
    }

    for (const [key, obs$] of entries) {
      obs$.subscribe(
        //eslint-disable-next-line no-loop-func
        (result) => {
          if (result.isErr()) {
            subscriber.next(result);
            subscriber.complete();
            return;
          }

          acc[key] = result.value;

          pending--;

          if (pending === 0) {
            subscriber.next(ok(acc));
            subscriber.complete();
          }
        },
      );
    }
  });
}
