import { FC } from "react";
import Box from "../Box/Box";
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
        <Box as="p">Copyright {currentYear}, Valerio Narcisi</Box>
      </Box>
    </>
  );
};

export default Layout;
