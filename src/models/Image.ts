import * as S from "@effect/schema/Schema";


export const ImageSchema = S.Struct({
    id: S.optional(S.String),
    url: S.String,
    width: S.optional(S.Number),
    height: S.optional(S.Number),
    filename: S.optional(S.String)
})
export type TImage = S.Schema.Type<typeof ImageSchema>;
