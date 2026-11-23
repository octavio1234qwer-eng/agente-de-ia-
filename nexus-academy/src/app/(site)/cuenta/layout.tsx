import { requireUser } from "@/lib/auth";
import { AccountNav } from "@/components/account/account-nav";
import { Avatar } from "@/components/ui/avatar";

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser("/cuenta");
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="flex items-center gap-4">
        <Avatar name={user.full_name || user.email} url={user.avatar_url} size={56} />
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-semibold text-white">{user.full_name || "Mi cuenta"}</h1>
          <p className="truncate text-sm text-mist-400">{user.email}</p>
        </div>
      </div>
      <div className="mt-8 grid gap-8 lg:grid-cols-[220px_1fr]">
        <AccountNav />
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
