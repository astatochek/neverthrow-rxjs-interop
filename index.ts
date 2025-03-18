import { err, ok, Result } from "neverthrow";
import {
  catchError,
  map,
  Observable,
  of,
  switchMap,
  type UnaryFunction,
} from "rxjs";

type Prettify<T> = {
  [K in keyof T]: T[K];
} & {};

function mapResult<T, U, E = Error>(
  project: (v: T) => U,
): UnaryFunction<Observable<Result<T, E>>, Observable<Result<U, E>>> {
  return map((r) => r.map(project));
}

function switchMapResult<T, U, E1 = Error, E2 = Error>(
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

type ExtractErrFromSource<
  T extends Record<string, Observable<Result<any, any>>>,
> = T[keyof T] extends Observable<Result<any, infer E>> ? E : never;

type ExtractOkFromSource<
  T extends Record<string, Observable<Result<any, any>>>,
> = {
  [Key in keyof T]: T[Key] extends Observable<Result<infer O, any>> ? O : never;
};

function forkJoinResult<T extends Record<string, Observable<Result<any, any>>>>(
  sources: T,
): Observable<Result<Prettify<ExtractOkFromSource<T>>, ExtractErrFromSource<T>>> {
  const entries = Object.entries(sources) as [
    string,
    Observable<Result<any, any>>,
  ][];

  return new Observable((subscriber) => {
    const acc: Record<string, any> = {};

    let pending = entries.length;

    // handle empty object
    if (pending === 0) {
      subscriber.next(ok({} as any));
      subscriber.complete();
      return;
    }

    for (const [key, obs$] of entries) {
      obs$.pipe(catchError((error) => of(err(error)))).subscribe({
        next: (result) => {
          if (result.isErr()) {
            subscriber.next(result);
            subscriber.complete();
            return;
          }

          acc[key] = result.value;

          pending--;

          if (pending === 0) {
            subscriber.next(ok(acc) as any);
            subscriber.complete();
          }
        },
      });
    }
  });
}

// TEST

function getFoo() {
  return of(Math.random() > 0.5 ? ok("foo ok" as const) : err("foo:err"));
}

function getBar() {
  return of(Math.random() > 0.5 ? ok("bar ok" as const) : err("bar:err"));
}

forkJoinResult({ foo: getFoo(), bar: getBar() }).subscribe((res) => {
  if (res.isOk()) {
    console.log("ok:", res.value);
  } else {
    console.error("err:", res.error);
  }
});

// getFoo()
//   .pipe(switchMapResult(() => getBar()))
//   .subscribe((res) => {
//     if (res.isOk()) {
//       console.log("ok:", res.value);
//     } else {
//       console.error("err:", res.error);
//     }
//   });
