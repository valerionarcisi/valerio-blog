import { recipe } from "@vanilla-extract/recipes";
import { valerioSprinkles } from "../../styles/sprinkles.css";

export const typographyRecipe = recipe({
  variants: {
    variant: {
      title: valerioSprinkles({
        fontFamily: "title",
        fontSize: "title",
        fontWeight: "800",
        marginTop: {
          mobile:"large",
          desktop: "large",
        },
        color: "neutral",
      }),
      subtitle: valerioSprinkles({
        fontFamily: "subtitle",
        fontSize: "large",
        fontWeight: "600",
        marginTop: {
          mobile:"large",
          desktop: "large",
        },
        lineHeight: "tight",
      }),
      description: valerioSprinkles({
        fontFamily: "body",
        fontSize: "medium",
        fontWeight: "400",
        marginTop: {
          mobile:"large",
          desktop: "large",
        },
        lineHeight: "normal",
      }),
      body: valerioSprinkles({
        fontFamily: "body",
        fontSize: "medium",
        marginBottom: {
          mobile: "small", desktop: "small"
        },
        color: "neutral",
      }),
      small: valerioSprinkles({
        fontFamily: "body",
        fontSize: "small",
        marginBottom: "small",
      }),
      boxed: valerioSprinkles({
        backgroundColor: 'tertiary',
        color: 'primary',
        paddingX: 'small',
      })
    },
  },
  defaultVariants: {
    variant: "body",
  },
});

export type TypograsphyVariants = Parameters<typeof typographyRecipe>[0];
