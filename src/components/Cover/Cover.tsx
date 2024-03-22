import Box from "../Box/Box";
import clsx from "clsx";
import { imgStyle } from "./Cover.css";
import type { FC } from "react";

type TCover = {
  img: {
    src: string;
    alt: string;
  };
};

const Cover: FC<TCover> = ({img: { src, alt } }) => {
  return (
    <Box as="div">
      {src && <Box as="img" src={src} alt={alt} className={clsx(imgStyle)} />}
    </Box>
  );
};

export default Cover;
