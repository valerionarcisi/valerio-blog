import type { FC } from "react"
import clsx from "clsx"
import Box from "../Box/Box"
import { tagStyles } from "./Tag.css"


type Props = {
    label: string,
    href: string,
}


const Tag: FC<Props> = ({ label, href }) => {
    return (<Box as="span">
        <a className={clsx(tagStyles)} href={href}>{label.toUpperCase()}</a>
    </Box>)
}

export default Tag