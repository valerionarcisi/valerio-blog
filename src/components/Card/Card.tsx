import Box from "../Box/Box";
import clsx from "clsx";
import { cardStyle } from "./Card.css.ts";
import type { FC } from "react";
import Typography from "../Typography/Typography.tsx";
import { transitionImg } from "../Article/Article.css.ts";

type TCard = {
    title: string;
    label: string;
    description: string;
    link?: string;
    img: {
        src: string;
        alt: string;
    };
};

const ImageBoxed = ({ src, alt, link }: { src: string, alt: string, link?: string }) => {
    return (
        <Box
            as="img"
            className={
                clsx({
                    [cardStyle]: true,
                    [transitionImg]: !!link
                })
            }
            src={src}
            alt={alt}
        />
    );
}


const Card: FC<TCard> = ({ title, label, description, img: { src }, link }) => {
    return (
        <Box
            as={"div"}
            display={{
                mobile: "flex",
                tablet: "flex",
                desktop: "flex"
            }}
            flexDirection={{
                mobile: "column",
                tablet: "column",
                desktop: "column"
            }}
            alignItems={{
                mobile: "center",
                tablet: "center",
                desktop: "center"
            }}
            marginTop={{
                mobile: "large",
                tablet: "extraLarge",
            }}
        >
            <Box as="h4" color="neutral" backgroundColor="primary" margin="auto">{title}</Box>
            <Box as="div" marginBottom="large" />
            <Box as="div" display={{ mobile: "none" }}>
                {link &&
                    <Box as="a" target="_blank" href={link} >
                        <ImageBoxed src={src} alt={label} link={link} />
                    </Box>
                }
                {!link &&
                    <Box as="img" className={
                        clsx({
                            [cardStyle]: true,
                            [transitionImg]: !!link
                        })
                    }
                        src={src}
                        alt="{alt}"
                    />
                }
                <Box as="div" marginBottom="large" />
            </Box>
            <Box margin="auto">
                <Box
                    as="div"
                    width={{
                        mobile: "small",
                        tablet: "small",
                    }}
                    marginTop={{
                        mobile: "medium",
                        tablet: "large",
                    }}
                    display={{
                        mobile: "flex",
                        tablet: "flex",
                        desktop: "flex"
                    }}
                    flexDirection={{
                        mobile: "column",
                        tablet: "column",
                        desktop: "column"
                    }}
                    alignItems={{
                        mobile: "center",
                        tablet: "center",
                        desktop: "center"
                    }}
                    justifyContent={{
                        mobile: "center",
                        tablet: "center",
                        desktop: "center"
                    }}
                    textAlign="center"
                >
                    <Typography variant="body">
                        {link && <Box as="a" target="_blank" href={link}>{label}</Box>}
                        {!link && label}
                    </Typography>
                    <Typography variant="small">{
                        description.length > 100 ? `${description.substring(0, 97)}...` : description
                    }</Typography>
                </Box>
            </Box>
        </Box>
    );
};

export { ImageBoxed }
export default Card;
