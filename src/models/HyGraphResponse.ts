import * as S from "@effect/schema/Schema";

export const HyGraphResponseSchema = S.Struct({
    data: S.Record(S.String, S.Unknown),
    error: S.optional(S.String)
})

export type THyGraphResponse<K, T> = {
    data?: Record<K extends string ? K : never, T>;
    error?: Error;
}
