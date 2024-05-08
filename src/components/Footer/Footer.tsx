import Box from "../Box/Box"
import Typography from "../Typography/Typography"

const Footer = () => {
    const currentYear = new Date().getFullYear();
    return (
        <Box
            as="footer"
            backgroundColor="secondary"
            paddingX={{
                tablet: "extraLarge",
                mobile: "large",
            }}
            paddingY={{
                mobile: "medium",
                tablet: "large",
                desktop: "large",
            }}
        >
            <Box
                width="extraLarge"
                margin="auto"
                display={{
                    mobile: "flex",
                    tablet: "flex",
                    desktop: "grid",
                }}
                flexDirection={{
                    mobile: "column",
                    tablet: "column",
                }}
                gridTemplateColumns={1}
                color="neutral"
            >
                <Box as={"div"}>
                    <Typography variant="description">
                        <h3>Get in touch</h3>
                        <ul>
                            <li>
                                <a target="_blank" href="https://github.com/valerionarcisi"
                                >Github</a
                                >
                            </li>
                            <li>
                                <a
                                    target="_blank"
                                    href="https://www.linkedin.com/in/cv-valerio-narcisi/"
                                >LinkedIn</a
                                >
                            </li>
                            <li>
                                <a target="_blank" href="https://x.com/valerionarcisi">X</a>
                            </li>
                            <li>
                                <a target="_blank" href="https://boxd.it/2mFff">Letterboxd</a>
                            </li>
                        </ul>
                    </Typography>
                </Box>
                <Box as={"div"}>
                    <Typography variant="description">
                        <h3>
                            This website is made from <a
                                target="_blank"
                                href="https://maps.app.goo.gl/U4QDSCMwis5KvoaY8"
                            >"Le Marche Zozze"</a
                            > by me.<br /> Copyright {currentYear}
                        </h3>
                        <Typography variant="small">
                            This site uses no tracking or cookies, other than
                            privacy-respecting, GDPR-compliant analytics via <a
                                target="_blank"
                                href="https://plausible.io/">Plausible</a
                            >.
                        </Typography>
                    </Typography>
                    <Box marginTop="large" />
                    <Typography variant="small">
                        Made with <a target="_blank" href="https://astro.build">Astro</a>, <a
                            target="_blank"
                            href="https://reactjs.org">React</a
                        > and hosted on <a target="_blank" href="https://www.netlify.com"
                        >Netlify</a
                        >.
                    </Typography>
                </Box>
            </Box>
        </Box>
    )
}


export default Footer