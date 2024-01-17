import { FC } from "react";
import Box from "../Box/Box";
import Typography from "../Typography/Typography";
type Props = {
  children: React.ReactNode;
};

const Layout: FC<Props> = ({ children }) => {
  const currentYear = new Date().getFullYear();

  return (
    <>
      <Box as="header">i'm header</Box>
      <Box as="main">{children}</Box>
      <Box as="footer">
        <Typography variant="body">Copyright {currentYear}, Valerio Narcisi</Typography>
      </Box>
    </>
  );
};

export default Layout;
