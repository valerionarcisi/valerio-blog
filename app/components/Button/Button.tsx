import React, { FC } from "react";
import * as styles from "./styles.css";

export const Button: FC<{ children: React.ReactNode }> = ({ children }) => (
    <div className={styles.root}>{children}</div>
);