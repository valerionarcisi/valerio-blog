import type { FC } from "react";
import Box from "../Box/Box";
import clsx from "clsx";
import { footerStyle, headerStyle, layoutStyles } from "./Layout.css";
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
      <Box as="main" marginY={"extraLarge"}>{children}</Box>
      <Box as="footer">
        <Box className={clsx(footerStyle)}>Copyright {currentYear}, Valerio Narcisi</Box>
      </Box>
    </Box>
  );
};

export default Layout;
