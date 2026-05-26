import Link from 'next/link';

export function EmptyState({
  message,
  linkText = 'クイズを始める',
  linkHref = '/quiz/municipality',
}: {
  message: string;
  linkText?: string;
  linkHref?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <p className="text-sm text-muted-foreground">{message}</p>
      <Link
        href={linkHref}
        className="mt-3 text-sm text-primary underline underline-offset-4"
      >
        {linkText}
      </Link>
    </div>
  );
}
