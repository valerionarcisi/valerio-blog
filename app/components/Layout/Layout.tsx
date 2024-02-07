import { FC } from "react";
import Box from "../Box/Box";
import Typography from "../Typography/Typography";
import clsx from "clsx";
import { headerStyle, layoutStyles } from "./Layout.css";
type Props = {
  children: React.ReactNode;
};

const Layout: FC<Props> = ({ children }) => {
  const currentYear = new Date().getFullYear();

  return (
    <Box as="div" className={clsx(layoutStyles)}>
      <Box as="header">
        <Box className={clsx(headerStyle)}>HOME BLOG ABOUT</Box>
      </Box>
      <Box as="main">{children}</Box>
      <Box as="footer">
        <Box className={clsx(headerStyle)}>Copyright {currentYear}, Valerio Narcisi</Box>
      </Box>
    </Box>
  );
};

export default Layout;
