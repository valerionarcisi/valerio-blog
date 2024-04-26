import * as Schema from "@effect/schema/Schema";
import { Either } from "effect";

export class DecodeError {
    readonly _tag = "DecodeError";
    constructor(readonly error: string) { }
}

export function decodeUnknownEither<_, A>(schema: Schema.Schema<_, A>) {
    return (input: unknown) =>
        Schema.decodeUnknownEither(schema)(input, { errors: "all" }).pipe(
            Either.mapLeft(
                parseError => {
                    console.error('Decode error: ');
                    console.error(parseError);
                    return new DecodeError(parseError.message)
                }
            ),
        );
}
