export type Category = {
  id: string;
  name: string;
  description?: string | null;
};

export type SublinkItem = {
  id: string;
  name: string;
  url: string;
  description?: string | null;
};

export type LinkItem = {
  id: string;
  name: string;
  url: string;
  categoryId: string;
  description?: string | null;
  sublinks: SublinkItem[];
};
