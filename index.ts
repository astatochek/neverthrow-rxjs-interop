import { err, ok, Result } from "neverthrow";
import { map, Observable, of, switchMap, type UnaryFunction } from "rxjs";

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

// TEST

function getFoo(): Observable<Result<{ foo: number }, "foo:err">> {
  return of(Math.random() > 0.5 ? ok({ foo: 1 }) : err("foo:err"));
}

function getBar(): Observable<Result<{ bar: string }, "bar:err">> {
  return of(Math.random() > 0.5 ? ok({ bar: "1" }) : err("bar:err"));
}

getFoo()
  .pipe(switchMapResult(() => getBar()))
  .subscribe((res) => {
    if (res.isOk()) {
      console.log("ok:", res.value);
    } else {
      console.error("err:", res.error);
    }
  });
