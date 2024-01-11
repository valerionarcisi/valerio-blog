import { FC } from "react"
import Header from "../Header/Header"
import Main from "../Main/Main"
import Footer from "../Footer/Footer"
type Props = {
    children: React.ReactNode
}

const Layout: FC<Props> = ({ children }) => {
    return (
        <>
            <Header />
            <Main>{children}</Main>
            <Footer />
        </>
    )
}

export default Layout