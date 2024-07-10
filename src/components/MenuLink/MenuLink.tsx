import type { FC } from "react";
import Box from "../Box/Box";
import { linkActiveStyles, linkStyles } from "./MenuLink.css";
import clsx from "clsx";

type Props = {
    children: React.ReactNode,
    href: string,
    target?: "_blank" | "_self" | "_parent" | "_top",
    active?: boolean
}

const MenuLink: FC<Props> = ({ children, href, target = "_self", active = false }) => {
    return (<Box as="a" data-astro-prefetch href={href} target={target} 
        className={
            clsx({
                [linkStyles]: true,
                [linkActiveStyles]: active
            })
        }
    >
        {children}
    </Box>)
}


export default MenuLink