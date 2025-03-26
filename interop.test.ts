import { err, ok, Result } from "neverthrow";
import { firstValueFrom, Observable, of } from "rxjs";
import { forkJoinResult, mapResult, switchMapResult } from ".";

import {expect, test} from "bun:test"

type Expect<T extends true> = T
type Equal<X, Y> = (<T>() => T extends X ? 1 : 2) extends <T>() => T extends Y ? 1 : 2 ? true : false

test("maps the ok part", async () => {
    const one$ = of(ok("one" as const))
    const two$ = one$.pipe(mapResult(v => `${v} + ${v}` as const))

    const res = await firstValueFrom(two$);

    expect(res.isOk()).toBeTrue()

    if (res.isOk()) {
        expect(res.value).toBe('one + one')
        
        type Case = Expect<Equal<typeof res.value, 'one + one'>>
    }
})

test("dows not map the err", async () => {
    const one$ = of(err("one" as const))
    const two$ = one$.pipe(mapResult(v => `${v} + ${v}` as const))

    const res = await firstValueFrom(two$);

    expect(res.isErr()).toBeTrue()

    if (res.isErr()) {
        expect(res.error).toBe('one')
        
        type Case = Expect<Equal<typeof res.error, 'one'>>
    }
})

test("switch map maps ok to err", async () => {
    const one$: Observable<Result<any, "one">> = of(ok("one" as const))
    const two$ = one$.pipe(switchMapResult(v => of(err("two" as const))))

    const res = await firstValueFrom(two$);

    expect(res.isErr()).toBeTrue()

    if (res.isErr()) {
        expect(res.error).toBe('two')
        
        type Case = Expect<Equal<typeof res.error, 'one' | 'two'>>
    }
})

test("forkJoins infers the type for record source", async () => {
    function getFoo() {
        return of<Result<1, "foo_err">>(Math.random() > -1 ? ok(1) : err('foo_err'))
    }

    function getBar() {
        return of<Result<2, "bar_err">>(Math.random() > -1 ? ok(2) : err('bar_err'))
    }

    const joined$ = forkJoinResult({foo: getFoo(), bar: getBar()})

    const res = await firstValueFrom(joined$);

    expect(res.isOk()).toBeTrue()

    if (res.isOk()) {
        expect(res.value).toEqual({foo: 1, bar: 2})
    }

    type Case = Expect<Equal<typeof res, Result<{foo: 1, bar: 2}, 'foo_err' | 'bar_err'>>>
})

test("forkJoins infers the type for an array source with homogenous type", async () => {
    function getFoo() {
        return of<Result<1, "foo_err">>(Math.random() > -1 ? ok(1) : err('foo_err'))
    }

    const joined$ = forkJoinResult([getFoo(), getFoo()])

    const res = await firstValueFrom(joined$);

    expect(res.isOk()).toBeTrue()

    if (res.isOk()) {
        expect(res.value).toEqual([1, 1])
    }

    type Case = Expect<Equal<typeof res, Result<1[], 'foo_err'>>>
})


