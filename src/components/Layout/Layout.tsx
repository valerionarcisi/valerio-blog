import type { FC } from "react";
import Box from "../Box/Box";
import clsx from "clsx";
import { footerStyle, headerStyle, layoutStyles } from "./Layout.css";
import MenuLink from "../MenuLink/MenuLink";
type Props = {
  children: React.ReactNode;
  pathname?: string;
};

const Layout: FC<Props> = ({ children, pathname }) => {

  const currentYear = new Date().getFullYear();

  return (
    <Box as="body">
      <Box as="div" className={clsx(layoutStyles)}>
        <Box as="header" className={clsx(headerStyle)}>
          <MenuLink href="/" active={pathname === "/"} >
            HOME
          </MenuLink>
          <MenuLink href="/" active={pathname?.includes("/post")}>
            BLOG
          </MenuLink>
          <MenuLink href="/contact" active={pathname === "/contact"}>
            CONTACT
          </MenuLink>
        </Box>
        <Box as="main" paddingY={"extraLarge"} width={"extraLarge"} margin={"auto"}>
          {children}
        </Box>
        <Box as="footer">
          <Box className={clsx(footerStyle)}>Copyright {currentYear}, Valerio Narcisi</Box>
        </Box>
      </Box>
    </Box>
  );
};

export default Layout;
