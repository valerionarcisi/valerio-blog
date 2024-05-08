import * as S from "@effect/schema/Schema";
import { ImageSchema } from "./Image";


export const AuthorSchema = S.Struct({
    name: S.String,
    picture: ImageSchema
})
export type TAuthor = S.Schema.Type<typeof AuthorSchema>;
