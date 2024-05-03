import type { FC } from "react";
import clsx from "clsx";

import "normalize.css";
import "sakura.css";
import "@fontsource/staatliches/400.css";
import "@fontsource/merriweather";
import "../../styles/global.css";
import { headerStyle, layoutStyles } from "./Layout.css";
import { defaultTheme } from "../../styles/defaultTheme.css";


import Box from "../Box/Box";
import MenuLink from "../MenuLink/MenuLink";
import Typography from "../Typography/Typography";
import { SEO, type SeoProps } from "../SEO/SEO";
import type React from "react";

type Props = {
  children: React.ReactNode;
  seo?: SeoProps;
  pathname?: string;
};

const Layout: FC<Props> = ({ children, pathname, seo }) => {
  const currentYear = new Date().getFullYear();

  return (
    <html lang="en" className={clsx(defaultTheme)}>
      <SEO
        title={seo?.title || "Valerio Narcisi"}
        description={seo?.description || "Valerio Narcisi - Web Developer, Director and Screenwriter"}
        name={seo?.name || "Valerio Narcisi"}
        type={seo?.type || "website"}
        image={seo?.image || "https://media.graphassets.com/output=format:jpg/resize=width:250/11v3vMf8QMziD5ZAv6zY"}
      />
      <Box as="body">
        <Box as="header" className={clsx(headerStyle)}>
          <MenuLink href="/" active={pathname === "/"} >
            HOME
          </MenuLink>
          <MenuLink href="/blog" active={(pathname?.includes("/post") || pathname?.includes("/blog") || false)}>
            BLOG
          </MenuLink>
          <MenuLink href="/about" active={pathname === "/about"}>
            About me
          </MenuLink>
        </Box>
        <Box as="div" className={clsx(layoutStyles)}>
          <Box as="main"
            width={"fullLayout"}
            margin="auto">
            <Box
              as="div"
              paddingY={{
                mobile: "large",
                tablet: "extraLarge",
                desktop: "extraLarge"
              }}
            >
              {children}
            </Box>
          </Box>
        </Box>
        <Box as="footer"
          backgroundColor="secondary"
          paddingX={{
            tablet: "extraLarge",
            mobile: "large",
          }}
          paddingY={{
            mobile: "medium",
            tablet: "large",
            desktop: "large"
          }}
        >
          <Box width="extraLarge"
            margin="auto"
            display={{
              mobile: "flex",
              tablet: "flex",
              desktop: "grid"
            }}
            flexDirection={{
              mobile: "column",
              tablet: "column",
            }}
            gridTemplateColumns={1}
            color="neutral">
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
                  This site uses no tracking or cookies, other than privacy-respecting, GDPR-compliant analytics via Netflify Analytics.
                </Typography>
              </Typography>
              <Box marginTop="large" />
              <Typography variant="small">
                Made with <a target="_blank" href="https://astro.build">Astro</a>, <a target="_blank" href="https://reactjs.org">React</a> and hosted on <a target="_blank" href="https://www.netlify.com">Netlify</a>.
              </Typography>
            </Box>
          </Box>
        </Box>
      </Box>
    </html>
  );
};

export default Layout;
