import { MetaFunction } from "@remix-run/node";
import About from "./About";


export const meta: MetaFunction = () => {
    return [
        { title: "Valerio Narcisi | Frontend engineer" },
        {
            property: "og:title",
            content: "Valerio Narcisi | Frontend engineer"
        },
        {
            name: "description",
            content:
                "Personal website of Valerio Narcisi with posts, bio, contacts, etc"
        }
    ];
};
export default function Index() {
    return (<About />);
}
