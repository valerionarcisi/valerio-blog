import { FC } from "react";
import Box from "../Box/Box";
import Typography from "../Typography/Typography";
import clsx from "clsx";
import { imgStyle, titleStyle } from "./Cover.css";

type TCover = {
  title: string;
  img: {
    src: string;
    alt: string;
  };
  author: string;
  date: string;
};

const Cover: FC<TCover> = ({ title, img: { src, alt }, author, date }) => {
  return (
    <Box as="header" position={"relative"}>
      <Box as="div" className={clsx(titleStyle)}>
        <Box
          as={"div"}
          width={"large"}
          margin={"auto"}
          display={"flex"}
          flexDirection={"column"}
          textAlign="center"
        >
          <Box as="div" display={"flex"} flexDirection={"column"} textAlign="center">
            <Typography variant="heading">{title}</Typography>
            <Typography variant="body">Author: {author}</Typography>
            <Typography variant="body">Posted on: {date}</Typography>
            <Box as="div" margin={"auto"} display={"flex"}>
              <Box as="span" paddingLeft={"small"}>
                <Typography variant="small">
                  <a href="/tags/javascript">javascript</a>
                </Typography>
              </Box>
              <Box as="span" paddingLeft={"small"}>
                <Typography variant="small">
                  <a href="/tags/javascript">movie</a>
                </Typography>
              </Box>
              <Box as="span" paddingLeft={"small"}>
                <Typography variant="small">
                  <a href="/tags/javascript">book</a>
                </Typography>
              </Box>
            </Box>
          </Box>
        </Box>
      </Box>
      <Box as="img" src={src} alt={alt} className={clsx(imgStyle)} />
    </Box>
  );
};

export default Cover;
