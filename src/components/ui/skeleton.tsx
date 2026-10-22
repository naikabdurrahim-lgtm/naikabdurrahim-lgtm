import { cn } from '@/lib/utils';

/** Loading placeholder — no blank screens (PROJECT_RULES 3.1 #14). */
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div aria-hidden="true" className={cn('skeleton h-4 w-full', className)} {...props} />;
}
