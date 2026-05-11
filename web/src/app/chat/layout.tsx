"use client";

export default function ChatLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[60] bg-background">
      {children}
    </div>
  );
}
