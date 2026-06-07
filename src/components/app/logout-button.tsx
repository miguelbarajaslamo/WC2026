"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export function LogoutButton({ className }: { className?: string }) {
  const router = useRouter();

  async function logout() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      className={
        className ??
        "flex w-full items-center gap-3 rounded-lg border border-black/10 bg-white p-4 text-left font-black text-red-700"
      }
      onClick={logout}
      type="button"
    >
      <LogOut size={20} />
      Logout
    </button>
  );
}
