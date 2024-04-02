import { Effect } from "effect";

export const getJson = (res: Response) => Effect.tryPromise({
    try: () => res.json() as Promise<unknown>,
    catch: () => "json" as const,
});

export const getText = (res: Response) => Effect.tryPromise({
    try: () => res.text() as Promise<string>,
    catch: () => "text" as const,
})