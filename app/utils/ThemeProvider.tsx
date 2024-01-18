import {
  createContext,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
  useContext,
} from "react";
import { defaultTheme } from "~/styles/defaultTheme.css";

const themes = {
  DEFAULT: defaultTheme,
  // TODO
  LIGHT: "light",
};

type Themes = (typeof themes)[keyof typeof themes];

type ThemeContextType = [Themes | null, Dispatch<SetStateAction<Themes | null>>];

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Themes | null>(themes.DEFAULT);

  return <ThemeContext.Provider value={[theme, setTheme]}>{children}</ThemeContext.Provider>;
}

function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}

export { themes, ThemeProvider, useTheme };
