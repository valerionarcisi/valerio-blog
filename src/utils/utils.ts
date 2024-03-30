import { Effect } from "effect";

export const getJson = (res: Response) => Effect.tryPromise({
    try: () => res.json() as Promise<unknown>,
    catch: () => "json" as const,
});
