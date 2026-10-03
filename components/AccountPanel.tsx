"use client";

import { useAuth } from "@/context/AuthContext";
import { useState, type FormEvent } from "react";

export default function AccountPanel() {
  const { configured, loading, user, stats, signIn, signUp, signOut } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      if (mode === "signup") {
        if (name.trim().length < 3) throw new Error("Name must be at least 3 characters");
        await signUp(name, email, password);
      } else {
        await signIn(email, password);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not authenticate");
    } finally {
      setSubmitting(false);
    }
  };

  if (!configured) {
    return (
      <div className="rounded-xl border border-[#f0c95a]/25 bg-[#3b3525] p-4 text-sm text-[#eadca4]">
        Add the Appwrite environment variables to enable accounts and play.
      </div>
    );
  }

  if (loading) {
    return <p className="text-sm text-[#9d9b98]">Loading account…</p>;
  }

  if (user) {
    return (
      <div className="rounded-xl border border-white/10 bg-[#262522] p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-bold text-white">{user.name || user.email.split("@")[0]}</p>
            <p className="text-xs text-[#9d9b98]">{user.email}</p>
          </div>
          <button type="button" onClick={() => void signOut()} className="text-xs font-bold text-[#b7b5b2] hover:text-white">
            Sign out
          </button>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          {[["Games", stats?.games ?? "—"], ["Wins", stats?.wins ?? "—"], ["Losses", stats?.losses ?? "—"]].map(([label, value]) => (
            <div key={label} className="rounded-lg bg-[#312f2c] px-2 py-2">
              <p className="text-lg font-black text-white">{value}</p>
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#777471]">{label}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <div className="grid grid-cols-2 rounded-lg bg-[#262522] p-1 text-sm font-bold">
        {(["signin", "signup"] as const).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => { setMode(option); setError(null); }}
            className={`rounded-md px-3 py-2 ${mode === option ? "bg-[#454341] text-white" : "text-[#9d9b98]"}`}
          >
            {option === "signin" ? "Sign in" : "Create account"}
          </button>
        ))}
      </div>
      {mode === "signup" && (
        <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Display name" autoComplete="name" required minLength={3} maxLength={32} className="min-h-11 rounded-lg border border-white/10 bg-[#262522] px-4 text-white outline-none placeholder:text-[#777471] focus:border-[#81b64c]" />
      )}
      <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" placeholder="Email" autoComplete="email" required className="min-h-11 rounded-lg border border-white/10 bg-[#262522] px-4 text-white outline-none placeholder:text-[#777471] focus:border-[#81b64c]" />
      <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" placeholder="Password" autoComplete={mode === "signup" ? "new-password" : "current-password"} required minLength={8} className="min-h-11 rounded-lg border border-white/10 bg-[#262522] px-4 text-white outline-none placeholder:text-[#777471] focus:border-[#81b64c]" />
      <button disabled={submitting} className="primary-action min-h-11 rounded-lg px-5 font-extrabold disabled:opacity-60">
        {submitting ? "Working…" : mode === "signin" ? "Sign in" : "Create account"}
      </button>
      {error && <p role="alert" className="text-sm text-[#ffc2bc]">{error}</p>}
    </form>
  );
}
