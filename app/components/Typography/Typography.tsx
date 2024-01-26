import { ElementType, FC, ReactNode } from "react";
import { TypograsphyVariants, typographyRecipe } from "./Typography.css";
import Box from "../Box/Box";

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
    <Box as={variantAs[variant || "span"]} className={typographyRecipe({ variant })}>
      {children}
    </Box>
  );
};

export default Typography;
