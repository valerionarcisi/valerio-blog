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
        color: "secondary",
        "-webkit-text-stroke": "medium",
      }),
      subheading: valerioSprinkles({
        fontFamily: "heading",
        fontSize: "large",
        fontWeight: "600",
        marginTop: "large",
        marginBottom: "large",
      }),
      body: valerioSprinkles({
        fontFamily: "body",
        fontSize: "medium",
        marginBottom: "small",
      }),
      small: valerioSprinkles({
        fontFamily: "body",
        fontSize: "small",
        marginBottom: "small",
      }),
    },
  },
  defaultVariants: {
    variant: "body",
  },
});

export type TypograsphyVariants = Parameters<typeof typographyRecipe>[0];
