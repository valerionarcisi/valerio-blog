import { FC } from "react";
import Layout from "~/components/Layout/Layout";
import Typography from "~/components/Typography/Typography";
import { codeClass, postBodyClass } from "./Home.css";
import Box from "~/components/Box/Box";
import Cover from "~/components/Cover/Cover";
import clsx from "clsx";

const Home: FC = () => {
  return (
    <Layout>
      <Box as="article" display="flex" flexDirection="column">
        <Cover
          img={{ src: "/images/The-Big-Lebowski-1.jpeg", alt: "Example Image" }}
          title="The Dude: Yeah, well - The Dude abides."
        />
        <Box as="div" backgroundColor="secondary" padding="large">
          <Box as="div" width="extraLarge" margin="auto">
            <Box as="div" margin={"auto"} display={"flex"} flexDirection={"column"}>
              <Typography variant="body">Posted on: 2022-01-01</Typography>
            </Box>
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
            <Box as="section" className={postBodyClass}>
              <h2>
                <a href="#">Lorem ipsum dolor sit amet</a>, consectetur adipiscing elit, sed do
                eiusmod tempor incididunt ut labore et dolore magna aliqua.
              </h2>
              <h3>
                <a href="#">Lorem ipsum dolor sit amet</a>, consectetur adipiscing elit, sed do
                eiusmod tempor incididunt ut labore et dolore magna aliqua.
              </h3>
              <h4>
                <a href="#">Lorem ipsum dolor sit amet</a>, consectetur adipiscing elit, sed do
                eiusmod tempor incididunt ut labore et dolore magna aliqua.
              </h4>
              <h5>
                <a href="#">Lorem ipsum dolor sit amet</a>, consectetur adipiscing elit, sed do
                eiusmod tempor incididunt ut labore et dolore magna aliqua.
              </h5>
              <p>
                <a href="#">Lorem ipsum dolor sit amet</a>, consectetur adipiscing elit, sed do
                eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam,
                quis nostrud exercitation ullamco voluptate velit esse cillum dolore eu fugiat nulla
                pariatur laboris nisi ut aliquip ex ea commodo consequat.
              </p>
              <p>
                <a href="#">Lorem ipsum dolor sit amet</a>, consectetur adipiscing elit, sed do
                eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam,
                quis nostrud exercitation ullamco voluptate velit esse cillum dolore eu fugiat nulla
                pariatur laboris nisi ut aliquip ex ea commodo consequat.
              </p>
              <p>
                <img
                  style={{ width: "500px", marginRight: "20px", float: "left" }}
                  src="/images/vertical-img.jpg"
                  alt="Example Image"
                />
                <a href="#">Lorem ipsum dolor sit amet</a>, consectetur adipiscing elit, sed do
                eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam,
                quis nostrud exercitation ullamco voluptate velit esse cillum dolore eu fugiat nulla
                pariatur laboris nisi ut aliquip ex ea commodo consequat.
                <br />
                <a href="#">Lorem ipsum dolor sit amet</a>, consectetur adipiscing elit, sed do
                eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam,
                quis nostrud exercitation ullamco voluptate velit esse cillum dolore eu fugiat nulla
                pariatur laboris nisi ut aliquip ex ea commodo consequat.
                <br />
                <br />
                <a href="#">Lorem ipsum dolor sit amet</a>, consectetur adipiscing elit, sed do
                eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam,
                quis nostrud exercitation ullamco voluptate velit esse cillum dolore eu fugiat nulla
                pariatur laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in
                reprehenderit in Excepteur sint occaecat cupidatat non proident, sunt in culpa qui
                officia deserunt mollit anim id est laborum.
                <br />
                <br />
              </p>
              <code className={codeClass}>
                {`describe('A11y fails', () => {
              beforeEach(() => {
                cy.visit('index-bad.html')
              })

              it('loads', () => {
                cy.contains('p', 'hard to read')
              })

              // NOTE: skip this test on purpose - enable to see failing color contrast check
              it.skip('does not pass accessibility check', () => {
                cy.contains('p', 'hard to read')
                cy.injectAxe()
                cy.checkA11y()
            })
          })`}
              </code>
            </Box>
          </Box>
        </Box>
        <Box
          as="iframe"
          height="500"
          src="https://www.youtube.com/embed/7TpiIvEq5l8?si=bcs86orkqSdhOdb9"
          title="YouTube video player"
          frameBorder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          margin="none"
        />
        <button>Click ME</button>
      </Box>
    </Layout>
  );
};

export default Home;
