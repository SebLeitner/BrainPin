export type Category = {
  id: string;
  name: string;
};

export type LinkItem = {
  id: string;
  name: string;
  url: string;
  categoryId: string;
  description?: string | null;
};
