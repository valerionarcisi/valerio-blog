
export interface CreatePostInput {
  title: string;
  slug?: string;
  date: string; // Format: YYYY-MM-DD
  extract?: string;
  content: string;
  tags: string[];
  lang: string;
  coverImageId?: string; // ID of existing asset
  coverImageUrl?: string; // URL to upload new image
  coverDescription?: string;
  coverAuthorName?: string;
  coverAuthorLink?: string;
}

export interface CreatePostResponse {
  id: string;
  slug: string;
  title: string;
}

const createPost = async (input: CreatePostInput): Promise<CreatePostResponse> => {
  const CREATE_POST_MUTATION = `
    mutation CreatePost($data: PostCreateInput!) {
      createPost(data: $data) {
        id
        slug
        title
      }
    }
  `;

  // Handle cover image - either use existing asset ID or create from URL
  let coverImageInput;
  if (input.coverImageId) {
    coverImageInput = {
      connect: {
        id: input.coverImageId
      }
    };
  } else if (input.coverImageUrl) {
    coverImageInput = {
      create: {
        upload: input.coverImageUrl
      }
    };
  } else {
    throw new Error("Either coverImageId or coverImageUrl must be provided");
  }

  const variables = {
    data: {
      title: input.title,
      slug: input.slug,
      date: input.date,
      extract: input.extract,
      content: input.content,
      tags: input.tags,
      lang: input.lang,
      coverImage: coverImageInput,
      coverDescription: input.coverDescription,
      coverAuthorName: input.coverAuthorName,
      coverAuthorLink: input.coverAuthorLink,
    }
  };

  try {
    // Use API endpoint with auth token for mutations
    const apiEndpoint = process.env.HYGRAPH_API_ENDPOINT || import.meta.env.HYGRAPH_API_ENDPOINT;
    const token = process.env.HYGRAPH_TOKEN || import.meta.env.HYGRAPH_TOKEN;

    if (!apiEndpoint || !token) {
      throw new Error("HYGRAPH_API_ENDPOINT and HYGRAPH_TOKEN must be set in environment variables");
    }

    const response = await fetch(apiEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify({
        query: CREATE_POST_MUTATION,
        variables,
      }),
    });

    if (!response.ok) {
      throw new Error(`GraphQL request failed: ${response.statusText}`);
    }

    const json = await response.json();

    if (json.errors) {
      throw new Error(`GraphQL errors: ${JSON.stringify(json.errors, null, 2)}`);
    }

    return json.data.createPost;
  } catch (error) {
    console.error("Error creating post:", error);
    throw error;
  }
};

export default createPost;
