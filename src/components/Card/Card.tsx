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

const Card: FC<TCard> = ({ title, label, description, img: { src }, link }) => {
    return (
        <Box
            as={"div"}
            display={"flex"}
            flexDirection={"column"}
            textAlign="center"
        >
            <Box as="h4" color="neutral" backgroundColor="primary" margin="auto">{title}</Box>
            <Box as="div" marginBottom="large" />
            {link &&
                <Box as="a" target="_blank" href={link} >
                    <Box as="div" className={
                        clsx({
                            [cardStyle]: true,
                            [transitionImg]: !!link
                        })
                    }
                        style={{ backgroundImage: `url(${src})` }}
                    />
                </Box>
            }
            {!link &&
                <Box as="div" className={
                    clsx({
                        [cardStyle]: true,
                        [transitionImg]: !!link
                    })
                }
                    style={{ backgroundImage: `url(${src})` }}
                />
            }
            <Box as="div" marginBottom="large" />
            <Box margin="auto">
                <Box as="div" marginTop="medium">
                    <Typography variant="body">
                        {link && <Box as="a" target="_blank" href={link}>{label}</Box>}
                        {!link && label}
                    </Typography>
                    <Typography variant="small">{description}</Typography>
                </Box>
            </Box>
        </Box>
    );
};

export default Card;
