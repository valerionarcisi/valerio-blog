import { LoaderFunction, MetaFunction, json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
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

export const loader: LoaderFunction = async () => {
  const res = await fetch("https://alexmuraro.me/wp-json/wp/v2/posts");
  return json(await res.json());
};

export default function Index() {
  const posts = useLoaderData<typeof loader>();
  return <Home posts={posts} />;
}
