import type { ElementType, FC, ReactNode } from "react";
import Box from "../Box/Box";
import clsx from "clsx";
import { typographyRecipe } from "./Typography.css"


const as: Record<string, ElementType> = {
    h1: "h1",
    h2: "h2",
    h3: "h3",
    h4: "h4",
    span: "span"
} as const

type Tas = typeof as[keyof typeof as]

type BoxedTitleProps = {
    children: ReactNode;
    as?: Tas;
}


const BoxedTitle: FC<BoxedTitleProps> = ({ children, as }) => {
    return (
        <Box as={as || "h3"}>
            <Box as="span" className={clsx(typographyRecipe({ variant: "boxed" }))}>{children}</Box>
        </Box>
    );
};

export default BoxedTitle;
