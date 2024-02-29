export type TTags = Array<string>;
export type TImage = {
  id: string;
  url: string;
  width?: number;
  height?: number;
  filename: string;
};

export type TAutor = {
  name: string;
  picture: TImage;
};

export type TPost = {
  id: string;
  title: string;
  content: string;
  slug: string;
  date: string;
  publishedAt?: string;
  tags: TTags;
  coverImage: TImage;
  authors: Array<TAutor>;
};


export type TPostAbstract = Omit<TPost, "content" | "authors" | "publishedAt">