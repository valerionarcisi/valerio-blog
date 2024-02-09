import type { FC } from "react";
import Box from "../Box/Box";
import clsx from "clsx";
import { footerStyle, headerStyle, layoutStyles } from "./Layout.css";
import Link from "../Link/Link";
type Props = {
  children: React.ReactNode;
  pathname?: string;
};

const Layout: FC<Props> = ({ children, pathname }) => {

  const currentYear = new Date().getFullYear();

  return (

    <Box as="div" className={clsx(layoutStyles)}>
      <Box as="header" className={clsx(headerStyle)}>
        <Box as="div" paddingX={"large"}>
          <Link href="/" active={pathname === "/"} >
            HOME
          </Link>
        </Box>
        <Box as="div" paddingX={"large"}>
          <Link href="/" active={pathname?.includes("/post")}>
            BLOG
          </Link>
        </Box>
        <Box as="div" paddingX={"large"}>
          <Link href="/contact" active={pathname === "/contact"}>
            CONTACT
          </Link>
        </Box>
      </Box>
      <Box as="main" paddingY={"extraLarge"} width={"extraLarge"} margin={"auto"}>
          {children}
      </Box>
      <Box as="footer">
        <Box className={clsx(footerStyle)}>Copyright {currentYear}, Valerio Narcisi</Box>
      </Box>
    </Box>
  );
};

export default Layout;
