import Box from "../Box/Box"
import { cardStyle } from "../Card/Card.css"
import BoxedTitle from "../Typography/BoxedTitle"
import Typography from "../Typography/Typography"
import valerioImage from "./../../../public/images/valerio_narcisi_selfie.jpg"

const Hero = () => {
    return (<Box as="div" display="flex" width="fullLayout"
        justifyContent={{
            mobile: "center",
            tablet: "center",
            desktop: "center",
        }}>
        <Box as="div" width="half">
            <Typography variant="title">
                <BoxedTitle as="span">
                    Hi I'm Valerio
                </BoxedTitle>
            </Typography>
            <Typography variant="title">
                I'm a web developer, director and screenwriter.
            </Typography>
            <Typography variant="subtitle">
                I currently work at <Box as="a" target="_blank" href="https://cleafy.com">.Cleafy</Box> as a frontend developer. <br />
            </Typography>
            <Typography variant="description">
                Over the past year I've been strengthening my knowledge on refactoring large PHP apps into modern Javascript. I'm working with JS, React, Redux, Angular, Typescript and Node.js.        </Typography>
            <Typography variant="description">
                In my free time I work as a director and screenwriter.<Box as="br" />
                <Box as="i">Caramella</Box> will be my first short film.
            </Typography>
        </Box>
        <Box as="div" width="third"
            display={{
                mobile: "flex",
                tablet: "flex",
                desktop: "flex"
            }}
            alignItems={{
                mobile: "center",
                tablet: "center",
                desktop: "center"
            }}
            justifyContent={{
                mobile: "center",
                tablet: "center",
                desktop: "center"
            }}>
            <Box
                as="img"
                display={{ mobile: "none" }}
                src={valerioImage.src}
                alt="Valerio Narcisi"
                className={cardStyle}
            />
        </Box>
    </Box>)
}

export default Hero