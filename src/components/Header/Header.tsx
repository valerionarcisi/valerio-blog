import type { FC } from "react"
import clsx from "clsx"
import { headerStyle } from "./Header.css"
import Box from "../Box/Box"
import MenuLink from "../MenuLink/MenuLink"

type Props = {
    pathname: string,
}

const Header : FC<Props> = ({ pathname }) => {
    return (
        <Box as="header" className={clsx(headerStyle)}>
            <MenuLink href="/" active={pathname === "/"}> HOME </MenuLink>
            <MenuLink
                href="/blog"
                active={pathname?.includes("/post") ||
                    pathname?.includes("/blog") ||
                    false}
            >
                BLOG
            </MenuLink>
            <MenuLink href="/about" active={pathname === "/about"}>
                About me
            </MenuLink>
        </Box>
    )
}

export default Header