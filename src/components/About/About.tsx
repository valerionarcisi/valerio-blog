import { type FC } from "react";

import Box from "../Box/Box";
import { postBodyStyle } from "../Post/Post.css";
import BoxedTitle from "../Typography/BoxedTitle";


const About: FC = () => {

    return (
        <Box
            as="article"
            display="flex"
            flexDirection="column"
            marginTop={{
                mobile: "large",
                tablet: "large",
                desktop: "large"
            }}>
            <Box as="div" textAlign={"center"}>
                <BoxedTitle>
                    Who I am
                </BoxedTitle>
            </Box>
            <Box as="div">
                <Box as="div" width="large" margin="auto">
                    <Box
                        as="section"
                        className={postBodyStyle}
                    >
                        <p>Greetings! I am Valerio, a seasoned professional with a diverse background spanning web development and filmmaking, currently based Le Marche, Italy.</p>
                        <Box as="div" textAlign={"center"}>
                            <Box
                                as="img"
                                boxShadow={{
                                    mobile: "small",
                                    tablet: "medium",
                                    desktop: "medium",
                                }}
                                borderRadius={{
                                    mobile: "large",
                                    tablet: "large",
                                    desktop: "large",
                                }}
                                src="https://media.graphassets.com/11v3vMf8QMziD5ZAv6zY"
                                alt="valerio-thumb.JPG" />
                        </Box>
                        <Box
                            as="hr"
                            marginY={{
                                mobile: "medium",
                                tablet: "large",
                                desktop: "large",
                            }}
                        />
                        <h2>Web Development Expertise:</h2>
                        <p>In my current role as a Frontend Developer at <a href="https://www.cleafy.com/">Cleafy</a>, I focus on refactoring large PHP apps into modern Javascript. Prior to this, I held a Senior Frontend Developer position at <a href="https://www.teamsystem.com/">Teamsystem</a> where i utilized technologies such as Angular, Typescript and Ngrx.</p>
                        <p>During this experience, I had the opportunity to serve as an internal speaker at a conference focused on Flux Architecture, employing Redux Toolkit and Ngrx.</p>
                        <p>I worked as a Senior Software Engineer at <a href="http://fieldtronics.it/">Fieldtronics Srl</a>. Here, I utilized technologies such as Node.js, React, Docker, and Serverless to drive innovation in agricultural solutions.</p>
                        <p>My journey in web development began at <a href="https://www.new-system.it/">New System Srl</a>, where I cultivated my skills as a PHP and WordPress developer.</p>

                        <h4>My Favorite Book: A Philosophy of Software Design by John Ousterhout</h4>

                        <Box
                            as="img"
                            boxShadow={{
                                mobile: "small",
                                tablet: "medium",
                                desktop: "medium",
                            }}
                            borderRadius={{
                                mobile: "large",
                                tablet: "large",
                                desktop: "large",
                            }}
                            src="https://svbtleusercontent.com/iN7SLgJLrcZZTPV4yH6cRt0xspap.jpg"
                            alt="a-philosophy-of-software-design.JPG"
                        />
                        <Box
                            as="hr"
                            marginY={{
                                mobile: "medium",
                                tablet: "large",
                                desktop: "large",
                            }}
                        />
                        <h2>Personal Insight:</h2>
                        <p>Outside of my professional pursuits, I find fulfillment in the company of my family. Married to Adriana, I am a proud father to two wonderful daughters, Bianca and Lea, who bring joy and balance to my life.</p>
                        <Box as="div" textAlign={"center"}>
                            <Box
                                as="img"
                                boxShadow={{
                                    mobile: "small",
                                    tablet: "medium",
                                    desktop: "medium",
                                }}
                                borderRadius={{
                                    mobile: "large",
                                    tablet: "large",
                                    desktop: "large",
                                }}
                                src="https://media.graphassets.com/output=format:jpg/resize=width:500/flHZNcv0T7WlqJLD7iRn"
                                alt="valerio-family-thumb.JPG"
                            />
                        </Box>
                        <Box
                            as="hr"
                            marginY={{
                                mobile: "medium",
                                tablet: "large",
                                desktop: "large",
                            }}
                        />
                        <h2>Filmmaking Journey:</h2>
                        <p>Alongside my passion for web development, I have a deep-rooted interest in storytelling through film. With a degree from <a href="https://www.officinemattoli.it/">Officine Mattoli</a>, I have written "Arturo," which garnered recognition at the Roccafluvione Film Festival.</p>
                        <iframe width="100%" height="315" src="https://www.youtube.com/embed/7TpiIvEq5l8?si=95DZqUv7cTlM8qNW" title="YouTube video player" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerPolicy="strict-origin-when-cross-origin" frameBorder={0} allowFullScreen></iframe>
                        <p>Currently, I am engaged in the creation of my latest endeavor, "Caramella," my first short film.</p>
                        <Box as="div" textAlign={"center"}>
                            <Box
                                as="img"
                                boxShadow={{
                                    mobile: "small",
                                    tablet: "medium",
                                    desktop: "medium",
                                }}
                                borderRadius={{
                                    mobile: "large",
                                    tablet: "large",
                                    desktop: "large",
                                }}
                                src="https://media.graphassets.com/output=format:jpg/resize=width:600/NdzLy2iQjag0XGFffSLQ"
                                alt="valerio-on-set1.JPG"
                            />
                        </Box>
                        <Box as="div" textAlign={"center"}>
                            <Box
                                as="img"
                                boxShadow={{
                                    mobile: "small",
                                    tablet: "medium",
                                    desktop: "medium",
                                }}
                                borderRadius={{
                                    mobile: "large",
                                    tablet: "large",
                                    desktop: "large",
                                }}
                                src="https://media.graphassets.com/output=format:jpg/resize=width:600/QQW2ZXliRVKzarGqL5F6"
                                alt="valerio-on-set2.JPG"
                            />
                        </Box>
                        <Box as="div" textAlign={"center"}>
                            <Box
                                as="img"
                                boxShadow={{
                                    mobile: "small",
                                    tablet: "medium",
                                    desktop: "medium",
                                }}
                                borderRadius={{
                                    mobile: "large",
                                    tablet: "large",
                                    desktop: "large",
                                }}
                                src="https://media.graphassets.com/output=format:jpg/resize=width:600/jZiM8u9rSG6URJs7oiOk"
                                alt="valerio-on-set3.JPG"
                            />
                        </Box>
                        <Box as="div" textAlign={"center"}>
                            <Box
                                as="img"
                                boxShadow={{
                                    mobile: "small",
                                    tablet: "medium",
                                    desktop: "medium",
                                }}
                                borderRadius={{
                                    mobile: "large",
                                    tablet: "large",
                                    desktop: "large",
                                }}
                                src="https://media.graphassets.com/output=format:jpg/resize=width:600/IE1uy3oSnKGhbkHqlnwX"
                                alt="valerio-on-set4.JPG"
                            />
                        </Box>
                        <Box
                            as="hr"
                            marginY={{
                                mobile: "medium",
                                tablet: "large",
                                desktop: "large",
                            }}
                        />
                        <h2>Skills</h2>
                        <ul>
                            <li>JS/TS</li>
                            <li>HTML / CSS / SASS</li>
                            <li>React</li>
                            <li>Redux</li>
                            <li>Cypress</li>
                            <li>Angular</li>
                            <li>Rxjs</li>
                            <li>Ngrx</li>
                            <li>Node.js</li>
                            <li>Serverless</li>
                            <li>Docker</li>
                        </ul>


                    </Box>
                </Box>
            </Box>
        </Box>
    );
};

export default About;
