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
      <Box as="div" className={clsx(layoutStyles)}>
        <Box as="main" width={"fullLayout"} paddingY={"extraLarge"} margin="auto">
          {children}
        </Box>
      </Box>
      <Box as="footer">
        <Box className={clsx(footerStyle)}>This website is made from Le Marche, Italy by Valerio Narcisi. Copyright {currentYear}</Box>
      </Box>
    </Box>
  );
};

export default Layout;
