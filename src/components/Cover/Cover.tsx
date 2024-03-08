import Box from "../Box/Box";
import clsx from "clsx";
import { imgStyle } from "./Cover.css";
import type { FC } from "react";

type TCover = {
  title: string;
  img: {
    src: string;
    alt: string;
  };
};

const Cover: FC<TCover> = ({ title, img: { src, alt } }) => {
  return (
    <Box as="div">
      <Box as="div">
        <Box
          as={"div"}
          display={"flex"}
          flexDirection={"column"}
          textAlign="center"
        >
          {title && <Box as="div" display={"flex"} flexDirection={"column"} textAlign="center">
            <Box as="h4">{title}</Box>
          </Box>}
        </Box>
      </Box>
      {src && <Box as="img" src={src} alt={alt} className={clsx(imgStyle)} />}
    </Box>
  );
};

export default Cover;
