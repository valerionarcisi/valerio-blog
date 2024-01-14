import { recipe } from "@vanilla-extract/recipes";
import { valerioSprinkles } from "~/styles/sprinkles.css";

export const typographyRecipe = recipe({
  variants: {
    variant: {
      heading: valerioSprinkles({
        fontFamily: "heading",
        fontSize: "extraLarge",
        fontWeight: "700",
        marginTop: "large",
        marginBottom: "medium",
      }),
      subheading: valerioSprinkles({
        fontFamily: "heading",
        fontSize: "large",
        fontWeight: "600",
        marginTop: "large",
        marginBottom: "medium",
      }),
      body: valerioSprinkles({
        fontFamily: "body",
        fontSize: "medium",
      }),
    },
  },
  defaultVariants: {
    variant: "body",
  },
});

export type TypograsphyVariants = Parameters<typeof typographyRecipe>[0];
