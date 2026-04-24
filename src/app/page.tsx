"use client";

import { useEffect, useState } from "react";

type Profile = {
  displayName: string;
  userId: string;
  pictureUrl?: string;
  statusMessage?: string;
};

type LiffStatus = "loading" | "ready" | "error";

export default function Home() {
  const [status, setStatus] = useState<LiffStatus>("loading");
  const [message, setMessage] = useState("Initializing LIFF...");
  const [profile, setProfile] = useState<Profile | null>(null);
  const liffId = process.env.NEXT_PUBLIC_LIFF_ID;

  useEffect(() => {
    const initializeLiff = async () => {
      if (!liffId) {
        setStatus("error");
        setMessage("NEXT_PUBLIC_LIFF_ID is missing.");
        return;
      }

      try {
        const { default: liff } = await import("@line/liff");
        await liff.init({ liffId });

        if (!liff.isLoggedIn()) {
          liff.login();
          return;
        }

        const userProfile = await liff.getProfile();
        setProfile(userProfile);
        setStatus("ready");
        setMessage("LIFF initialized successfully.");
      } catch (error) {
        setStatus("error");
        setMessage(error instanceof Error ? error.message : "Unknown LIFF error.");
      }
    };

    void initializeLiff();
  }, [liffId]);

  const handleLogout = async () => {
    const { default: liff } = await import("@line/liff");
    if (liff.isLoggedIn()) {
      liff.logout();
      window.location.reload();
    }
  };
  

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-4 px-6 py-12 font-sans">
      <h1 className="text-2xl font-bold">Ajikoi LIFF Starter</h1>
      <p className="text-sm text-zinc-600">
        Deploy this page to Vercel and set the deployed URL as your LIFF endpoint.
      </p>

      <section className="rounded-lg border border-zinc-200 p-4">
        <h2 className="text-lg font-semibold">Status</h2>
        <p className="mt-2 text-sm">
          <span className="font-medium">State:</span> {status}
        </p>
        <p className="text-sm">
          <span className="font-medium">Message:</span> {message}
        </p>
      </section>

      <section className="rounded-lg border border-zinc-200 p-4">
        <h2 className="text-lg font-semibold">Environment</h2>
        <p className="mt-2 break-all text-sm">
          <span className="font-medium">NEXT_PUBLIC_LIFF_ID:</span>{" "}
          {liffId ?? "(not set)"}
        </p>
      </section>

      <section className="rounded-lg border border-zinc-200 p-4">
        <h2 className="text-lg font-semibold">Profile</h2>
        {profile ? (
          <pre className="mt-2 overflow-x-auto rounded bg-zinc-50 p-3 text-xs">
            {JSON.stringify(profile, null, 2)}
          </pre>
        ) : (
          <p className="mt-2 text-sm text-zinc-600">No profile loaded yet.</p>
        )}
      </section>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={handleLogout}
          className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white"
        >
          Logout
        </button>
      </div>
    </main>
  );
}
