import type { ElementType, FC, ReactNode } from "react";
import Box from "../Box/Box";
import { typographyRecipe, type TypograsphyVariants } from "./Typography.css";

type TypographyProps = {
  children: ReactNode;
} & TypograsphyVariants;

const variantAs: Record<string, ElementType> = {
  title: "h1",
  subtitle: "h2",
  body: "p",
};

const Typography: FC<TypographyProps> = ({ variant, children }) => {
  return (
    <Box as={variantAs[variant || "span"]} className={typographyRecipe({ variant: variant || "body" })}>
      {children}
    </Box>
  );
};

export default Typography;
