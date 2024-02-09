import type { FC } from "react";
import Box from "../Box/Box";
import { linkActiveStyles, linkStyles } from "./Link.css";
import clsx from "clsx";

type Props = {
    children: React.ReactNode,
    href: string,
    target?: "_blank" | "_self" | "_parent" | "_top",
    active?: boolean
}

const Link: FC<Props> = ({ children, href, target = "_self", active = false }) => {
    return (<Box as="a" data-astro-prefetch href={href} target={target} className={clsx(linkStyles, active && linkActiveStyles)}>
        {children}
    </Box>)
}


export default Link