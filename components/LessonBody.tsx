import type { ComponentPropsWithoutRef } from "react";
import { compileMDX } from "next-mdx-remote/rsc";
import remarkGfm from "remark-gfm";

// Tables in legal text run wide; keep them scrollable instead of breaking
// the page's own width.
function Table(props: ComponentPropsWithoutRef<"table">) {
  return (
    <div className="not-prose my-6 overflow-x-auto rounded-xl border border-brand-wood-ring dark:border-white/10">
      <table
        {...props}
        className="min-w-full border-collapse text-[0.95em] leading-relaxed [&_td]:border-t [&_td]:border-brand-wood-ring/70 [&_td]:px-4 [&_td]:py-3 [&_td]:align-top [&_th]:bg-brand-wood-mist [&_th]:px-4 [&_th]:py-3 [&_th]:text-left [&_th]:font-semibold [&_th]:text-brand-wood dark:[&_td]:border-white/10 dark:[&_th]:bg-white/5 dark:[&_th]:text-brand-brass-soft"
      />
    </div>
  );
}

/** Renders a lesson's MDX body (GitHub-flavoured markdown enabled). */
export async function LessonBody({ source }: { source: string }) {
  const { content } = await compileMDX({
    source,
    options: { mdxOptions: { remarkPlugins: [remarkGfm] } },
    components: { table: Table },
  });

  return (
    <article className="prose prose-lg max-w-none dark:prose-invert">
      {content}
    </article>
  );
}
