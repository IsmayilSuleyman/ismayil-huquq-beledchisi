export type Issue = {
  id: string;
  issue_number: number;
  title: string;
  summary: string | null;
  published_at: string; // ISO date
  tags: string[];
  pdf_path: string;
  cover_path: string | null;
  page_count: number | null;
  file_size_bytes: number | null;
  read_count: number;
  download_count: number;
  created_at: string;
  updated_at: string;
};

export type IssueComment = {
  id: string;
  issue_id: string;
  author_name: string;
  body: string;
  created_at: string;
};

export type Book = {
  id: string;
  title: string;
  author: string | null;
  description: string | null;
  year: number | null;
  tags: string[];
  pdf_path: string;
  cover_path: string | null;
  page_count: number | null;
  file_size_bytes: number | null;
  created_at: string;
  updated_at: string;
};

export type BookWithUrls = Book & { coverUrl: string | null; pdfUrl: string };
