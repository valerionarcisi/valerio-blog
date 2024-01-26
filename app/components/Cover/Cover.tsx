import { FC } from "react";
import Box from "../Box/Box";
import Typography from "../Typography/Typography";
import clsx from "clsx";
import { coverContainer, imgStyle, titleStyle } from "./Cover.css";

type TCover = {
  title: string;
  img: {
    src: string;
    alt: string;
  };
};

const Cover: FC<TCover> = ({ title, img: { src, alt } }) => {
  return (
    <Box as="header" className={clsx(coverContainer)}>
      <Box as="div" className={clsx(titleStyle)}>
        <Box
          as={"div"}
          width={"extraLarge"}
          margin={"auto"}
          display={"flex"}
          flexDirection={"column"}
          textAlign="center"
        >
          <Box as="div" display={"flex"} flexDirection={"column"} textAlign="center">
            <Typography variant="title">{title}</Typography>
          </Box>
        </Box>
      </Box>
      {src && <Box as="img" src={src} alt={alt} className={clsx(imgStyle)} />}
    </Box>
  );
};

export default Cover;
