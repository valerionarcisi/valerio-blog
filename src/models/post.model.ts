export type TExcerpt = {
  protected: boolean;
  rendered: string;
};

export type TRendered = {
  rendered: string;
};

export type TPost = {
  id: number;
  title: TRendered;
  content: TRendered;
  excerpt: TExcerpt;
  slug: string;
  date: string;
};
