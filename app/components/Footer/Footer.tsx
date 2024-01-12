import { FC } from "react";

const Footer: FC = () => {
  const currentYear = new Date().getFullYear();
  return (
    <footer>
      <p>Copyright {currentYear}, Valerio Narcisi</p>
    </footer>
  );
};

export default Footer;
