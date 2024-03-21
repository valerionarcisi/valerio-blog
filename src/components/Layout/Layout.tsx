import type { FC } from "react";
import Box from "../Box/Box";
import clsx from "clsx";
import { footerStyle, headerStyle, layoutStyles } from "./Layout.css";
import MenuLink from "../MenuLink/MenuLink";
import Typography from "../Typography/Typography";
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
        <MenuLink href="/blog" active={pathname?.includes("/post") || pathname === "/blog"}>
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
      <Box as="footer" backgroundColor="secondary" paddingY="large">
        <Box width="extraLarge" margin="auto" display="grid" gridTemplateColumns={1} color="neutral">
          <Box as={"div"}>
            <Typography variant="description">
              <h3>Get in touch</h3>
              <ul>
                <li><a target="_blank" href="https://github.com/valerionarcisi">Github</a></li>
                <li><a target="_blank" href="https://www.linkedin.com/in/cv-valerio-narcisi/">LinkedIn</a></li>
                <li><a target="_blank" href="https://x.com/valerionarcisi">X</a></li>
                <li><a target="_blank" href="https://boxd.it/2mFff">Letterboxd</a></li>
              </ul>
            </Typography>
          </Box>
          <Box as={"div"}>
            <Typography variant="description">
              <h3>This website is made from <a target="_blank" href="https://maps.app.goo.gl/U4QDSCMwis5KvoaY8">"Le Marche Zozze"</a> by me.<br /> Copyright {currentYear}</h3>
              <Typography variant="small">
                This site uses no tracking or cookies, other than privacy-respecting, GDPR-compliant analytics via <a target="_blank" href="https://plausible.io">Plausible</a>.
              </Typography>
            </Typography>
            <Box marginTop="large" />
            <Typography variant="small">
              Made with <a target="_blank" href="https://astro.build">Astro</a>, <a target="_blank" href="https://reactjs.org">React</a>, <a target="_blank" href="https://vanilla-extract.style">Vanilla Extract</a> and hosted on <a target="_blank" href="https://www.netlify.com">Netlify</a>.
            </Typography>
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

export default Layout;
