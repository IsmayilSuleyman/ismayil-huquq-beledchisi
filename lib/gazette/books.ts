import { getServerSupabase, publicUrl } from "@/lib/gazette/supabase";
import type { Book, BookWithUrls } from "@/lib/gazette/types";

// Reads for the books library (/books). Rows are public; uploads and edits
// go through the admin desk's Books tab.

export function withBookUrls(book: Book): BookWithUrls {
  return {
    ...book,
    coverUrl: book.cover_path ? publicUrl(book.cover_path) : null,
    pdfUrl: publicUrl(book.pdf_path),
  };
}

export async function listBooks(): Promise<BookWithUrls[]> {
  const { data, error } = await getServerSupabase()
    .from("books")
    .select("*")
    .order("title", { ascending: true });
  if (error) {
    // Like the issues: an unreachable database renders an empty shelf, not an error page.
    console.error(`Failed to load books: ${error.message}`);
    return [];
  }
  return (data as Book[]).map(withBookUrls);
}

export async function getBook(id: string): Promise<BookWithUrls | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data } = await getServerSupabase().from("books").select("*").eq("id", id).maybeSingle();
  return data ? withBookUrls(data as Book) : null;
}
