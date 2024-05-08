import * as S from "@effect/schema/Schema";

const PageSchema = S.Struct({
    title: S.String,
    content: S.String
})
export type TPage = S.Schema.Type<typeof PageSchema>
