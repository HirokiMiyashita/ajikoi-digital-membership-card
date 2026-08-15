"use client";

export default function DevUserSwitcher({ currentUserId }: { currentUserId: string }) {
  return (
    <div className="fixed right-3 bottom-3 z-[100] rounded-lg bg-black/80 px-3 py-2 text-xs text-white">
      DEV: {currentUserId}
    </div>
  );
}
