import { FC } from "react";
import Layout from "~/components/Layout/Layout";
import Typography from "~/components/Typography/Typography";
import { codeClass } from "./Home.css";

const Home: FC = () => {
  return (
    <Layout>
      <article>
        <header>
          <img src="/images/example-1.jpg" alt="Example Image" />
          <Typography variant="heading">Lorem ipsum dolor sit amet</Typography>
          <Typography variant="body">Author: Valerio</Typography>
          <Typography variant="body">Posted on: 17 January 2024</Typography>
          <Typography variant="body">
            <a href="/tags/javascript">javascript</a>
          </Typography>
        </header>
        <Typography variant="body">
          <hr />
          body start here ...
          <h2>h2: Lorem ipsum dolor sit amet</h2>
          <h3>h3: Lorem ipsum dolor sit amet</h3>
          <h4>h4: Lorem ipsum dolor sit amet</h4>
          <h5>h5: Lorem ipsum dolor sit amet</h5>
          <h6>h6: Lorem ipsum dolor sit amet</h6>
          <p>
            <a href="#">Lorem ipsum dolor sit amet</a>, consectetur adipiscing elit, sed do eiusmod
            tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis
            nostrud exercitation ullamco voluptate velit esse cillum dolore eu fugiat nulla pariatur
            laboris nisi ut aliquip ex ea commodo consequat.
          </p>
          <p>
            <a href="#">Lorem ipsum dolor sit amet</a>, consectetur adipiscing elit, sed do eiusmod
            tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis
            nostrud exercitation ullamco voluptate velit esse cillum dolore eu fugiat nulla pariatur
            laboris nisi ut aliquip ex ea commodo consequat.
          </p>
          <img
            style={{ width: "200px", marginRight: "20px", float: "left" }}
            src="/images/vertical-img.jpg"
            alt="Example Image"
          />
          <a href="#">Lorem ipsum dolor sit amet</a>, consectetur adipiscing elit, sed do eiusmod
          tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud
          exercitation ullamco voluptate velit esse cillum dolore eu fugiat nulla pariatur laboris
          nisi ut aliquip ex ea commodo consequat.
          <br />
          <a href="#">Lorem ipsum dolor sit amet</a>, consectetur adipiscing elit, sed do eiusmod
          tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud
          exercitation ullamco voluptate velit esse cillum dolore eu fugiat nulla pariatur laboris
          nisi ut aliquip ex ea commodo consequat.
          <br />
          <br />
          <a href="#">Lorem ipsum dolor sit amet</a>, consectetur adipiscing elit, sed do eiusmod
          tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud
          exercitation ullamco voluptate velit esse cillum dolore eu fugiat nulla pariatur laboris
          nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in
          Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit
          anim id est laborum.
          <br />
          <br />
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
        </Typography>
        <iframe
          width="100%"
          height="500"
          src="https://www.youtube.com/embed/7TpiIvEq5l8?si=bcs86orkqSdhOdb9"
          title="YouTube video player"
          frameBorder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
        ></iframe>
      </article>
      <button>Click ME</button>
    </Layout>
  );
};

export default Home;
