import { FC } from "react";
import Layout from "~/components/Layout/Layout";
import Typography from "~/components/Typography/Typography";

const Home: FC = () => {
  return (
    <Layout>
      <img src="/images/example.jpg" alt="Example Image" />
      <Typography variant="heading">Lorem ipsum dolor sit amet</Typography>
      <Typography variant="subheading">Lorem ipsum dolor sit amet</Typography>
      <img src="/images/example-1.jpg" alt="Example Image" />
      <Typography variant="body">
        <a href="#">Lorem ipsum dolor sit amet</a>, consectetur adipiscing elit, sed do eiusmod
        tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud
        exercitation ullamco voluptate velit esse cillum dolore eu fugiat nulla pariatur laboris
        nisi ut aliquip ex ea commodo consequat.
        <br />
        <br />
        Duis aute irure dolor in reprehenderit in Excepteur sint occaecat cupidatat non proident,
        sunt in culpa qui officia deserunt mollit anim id est laborum.
        <iframe
          width="100%"
          height="500"
          src="https://www.youtube.com/embed/7TpiIvEq5l8?si=bcs86orkqSdhOdb9"
          title="YouTube video player"
          frameBorder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
        ></iframe>
        <code>
          console.log('aaaa') console.log('aaaa') console.log('aaaa') console.log('aaaa')
          console.log('aaaa')
        </code>
      </Typography>
      <button>Click ME</button>
    </Layout>
  );
};

export default Home;
