import type { FC } from "react";
import Box from "../Box/Box";
import Typography from "../Typography/Typography";
import type { TPost } from "../../models/model";
import BoxedTitle from "../Typography/BoxedTitle";
import Card from "../Card/Card";
import Article from "../Article/Article";

type Props = {
  posts: TPost[];
};

const Home: FC<Props> = ({ posts }) => {
  return (
    <Box as="div" display="flex" flexDirection="column" width="fullLayout">
      <Box as="div" width="extraLarge">
        <Typography variant="title">
          <BoxedTitle as="span">
            Hi I'm Valerio
          </BoxedTitle>
        </Typography>
        <Typography variant="title">
          I'm a web developer, director and screenwriter.
        </Typography>
        <Typography variant="subtitle">
          I currently work at <Box as="a" target="_blank" href="https://cleafy.com">.Cleafy</Box> as a frontend developer. <br />
        </Typography>
        <Typography variant="description">
          In my free time I work as a director and screenwriter.<Box as="br" />
          <Box as="i">
            <Box as="b">
              <Box as="u">Caramella</Box>
            </Box>
          </Box>
          &nbsp;will be my first short film.
          <Box as="br" />
        </Typography>
      </Box>
      <Box as="hr" marginY="extraLarge" width="fullLayout" />
      <Box as="section">
        <Box as="div" display={"flex"} flexDirection={"row"} alignItems="center">
          <Box as="div" width="medium" paddingX={"large"}>
            <Card
              img={{ src: "https://external-content.duckduckgo.com/iu/?u=https%3A%2F%2Fimages.justwatch.com%2Fposter%2F306719441%2Fs718%2Ftalk-to-me-2022.%257Bformat%257D&f=1&nofb=1&ipt=105c5ede64cae39768e07a780929982ef8ce6c360c5db259e862428b67e30c8c&ipo=images", alt: "Talk to me Cover" }}
              title="Last Watched"
              label="Talk to me"
              description="Danny Philippou & Michael Philippou (2022)"
              link="https://letterboxd.com/valenar/films/diary/"
            />
          </Box>
          <Box as="div" width="medium" paddingX={"large"}>
            <Card
              img={{ src: "https://media.pitchfork.com/photos/605637e95b4d06df02b71fde/master/w_1280%2Cc_limit/Cavalcade%252520album%252520cover.jpeg", alt: "Cavalcade" }}
              title="Listening"
              label="Cavalcade"
              description="black midi (2022)"
            />
          </Box>
          <Box as="div" width="medium" paddingX={"large"}>
            <Card
              img={{ src: "https://external-content.duckduckgo.com/iu/?u=https%3A%2F%2Fcdn.kobo.com%2Fbook-images%2F3fb0f98a-caee-4f36-ac94-2f858214b684%2F1200%2F1200%2FFalse%2Fstella-maris-36.jpg&f=1&nofb=1&ipt=aba325685c233e51620de1d6053226c12d8839d1f6fb00815c6c786cb6fa2d6c&ipo=images", alt: "Stella Maris Cover" }}
              title="On Reading"
              label="Stella Maris"
              description="Cormarc McCharty (2022)"
            />
          </Box>
        </Box>
      </Box>
      <Box as="hr" marginY="extraLarge" width="fullLayout" />
      {posts.length > 0 && <Box as="section" width="extraLarge" margin="auto">
        <Box as="div" display={"flex"} flexDirection={"column"} alignItems="center" marginBottom="extraLarge">
          <BoxedTitle as="h3">
            Recent Posts
          </BoxedTitle>
        </Box>
        <Box as="div" display={"flex"} flexDirection={"column"} alignItems="center">
          {posts.map((post) => (
            <Article key={post.id} post={post} />
          ))}
        </Box>
      </Box>}
    </Box >
  );
};

export default Home;
