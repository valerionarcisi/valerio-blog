import * as Schema from "@effect/schema/Schema";
import { formatError } from "@effect/schema/TreeFormatter"
import { Either } from "effect";

export class DecodeError {
    readonly _tag = "DecodeError";
    constructor(readonly error: string) { }
}

export function decodeUnknownEither<_, A>(schema: Schema.Schema<_, A>) {
    return (input: unknown) =>
        Schema.decodeUnknownEither(schema)(input, { errors: "all" }).pipe(
            Either.mapLeft(
                parseError => new DecodeError(formatError(parseError)),
            ),
        );
}
