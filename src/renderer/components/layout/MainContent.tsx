import React from 'react';

interface MainContentProps {
  title: string;
  children: React.ReactNode;
}

export function MainContent({ title, children }: MainContentProps) {
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Page header */}
      <header className="h-12 flex items-center px-6 border-b bg-background shrink-0">
        <h1 className="text-lg font-semibold">{title}</h1>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-auto p-6">{children}</main>
    </div>
  );
}
