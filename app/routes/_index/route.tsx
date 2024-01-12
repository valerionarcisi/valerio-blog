import { MetaFunction } from "@remix-run/node";
import Home from "~/routes/_index/Home";

export const meta: MetaFunction = () => {
  return [
    { title: "Valerio Narcisi | Frontend engineer" },
    {
      property: "og:title",
      content: "Valerio Narcisi | Frontend engineer",
    },
    {
      name: "description",
      content: "Personal website of Valerio Narcisi with posts, bio, contacts, etc",
    },
  ];
};
export default function Index() {
  return <Home />;
}
