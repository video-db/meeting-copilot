import * as React from 'react';
import { cn } from '../../lib/utils';

interface ScrollAreaProps extends React.HTMLAttributes<HTMLDivElement> {}

const ScrollArea = React.forwardRef<HTMLDivElement, ScrollAreaProps>(
  ({ className, children, ...props }, ref) => (
    <div ref={ref} className={cn('relative overflow-hidden', className)} {...props}>
      <div
        className={cn(
          'h-full w-full overflow-auto',
          // Subtle scrollbar styling
          '[&::-webkit-scrollbar]:w-2',
          '[&::-webkit-scrollbar-track]:bg-transparent',
          '[&::-webkit-scrollbar-thumb]:bg-slate-200',
          '[&::-webkit-scrollbar-thumb]:rounded-full',
          '[&::-webkit-scrollbar-thumb]:border-2',
          '[&::-webkit-scrollbar-thumb]:border-transparent',
          '[&::-webkit-scrollbar-thumb]:bg-clip-padding',
          'hover:[&::-webkit-scrollbar-thumb]:bg-slate-300',
          'dark:[&::-webkit-scrollbar-thumb]:bg-slate-700',
          'dark:hover:[&::-webkit-scrollbar-thumb]:bg-slate-600',
        )}
      >
        {children}
      </div>
    </div>
  )
);
ScrollArea.displayName = 'ScrollArea';

export { ScrollArea };
