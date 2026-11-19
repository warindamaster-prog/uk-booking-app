import Link from "next/link";

export function PublicHeader({ name, logo }: { name: string; logo: string | null }) {
  return (
    <header className="mb-6 flex items-center gap-3">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {logo && <img src={logo} alt="" width={48} height={48} className="h-12 w-12 rounded-md object-cover" />}
      <p className="text-lg font-semibold">{name}</p>
    </header>
  );
}

export function PublicFooter({ privacyUrl }: { privacyUrl: string | null }) {
  return (
    <footer className="mt-10 border-t border-neutral-300 pt-4 text-sm dark:border-neutral-700">
      {privacyUrl ? (
        <a href={privacyUrl} className="underline" rel="noopener noreferrer">Privacy notice</a>
      ) : (
        <Link href="/privacy" className="underline">Privacy notice</Link>
      )}
    </footer>
  );
}
