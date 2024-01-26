import { LoaderFunction, MetaFunction, json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import Post from "./Post";

// export const meta: MetaFunction = () => {
//     return [
//         { title: "Valerio Narcisi | Frontend engineer" },
//         {
//             property: "og:title",
//             content: "Valerio Narcisi | Frontend engineer",
//         },
//         {
//             name: "description",
//             content: "Personal website of Valerio Narcisi with posts, bio, contacts, etc",
//         },
//     ];
// };

export const loader: LoaderFunction = async ({ params }) => {
  const res = await fetch(`https://alexmuraro.me/wp-json/wp/v2/posts/?slug=${params.slug}`);
  return json(await res.json());
};

export default function Index() {
  const post = useLoaderData<typeof loader>();
  return <Post post={post[0]} />;
}
