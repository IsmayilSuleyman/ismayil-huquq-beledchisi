import Link from "next/link";

export default function NotFound() {
  return (
    <div className="py-32 grid place-items-center">
      <div className="olg-glass rounded-3xl p-12 text-center max-w-md">
        <p className="font-serif text-6xl mb-4 text-azure-soft">404</p>
        <p className="font-serif text-xl mb-2">This shelf is empty.</p>
        <p className="text-sm text-foreground/60 mb-7">
          The issue you are looking for doesn’t exist or hasn’t been published yet.
        </p>
        <Link href="/gazette" className="olg-btn olg-btn-primary">
          Back to the library
        </Link>
      </div>
    </div>
  );
}
