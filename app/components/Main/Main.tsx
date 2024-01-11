import { FC } from "react"
import { container } from "./Main.css"

type Props = {
    children: React.ReactNode
}

const Main: FC<Props> = ({ children }) => {
    return (
        <main className={container}>
            {children}
        </main>
    )
}

export default Main