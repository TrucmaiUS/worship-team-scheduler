import Link from "next/link";
import { Button } from "../ui/Button";
import { getSession } from "@/lib/auth";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Avatar } from "../ui/Avatar";

export async function Navbar() {
  const session = await getSession();

  async function handleLogout() {
    "use server";
    const cookieStore = await cookies();
    cookieStore.delete("auth-token");
    redirect("/");
  }

  return (
    <nav className="sticky top-0 z-50 w-full border-b-4 border-brand-black bg-brand-cream checkerboard-pink">
      <div className="container mx-auto flex h-16 items-center justify-between px-4 md:px-8 bg-brand-cream/95 border-x-4 border-brand-black">
        <Link 
          href={!session ? "/" : session.role === "ADMIN" ? "/admin" : "/schedule"} 
          className="editorial-heading text-2xl md:text-3xl text-brand-black hover:text-brand-pink transition-colors"
        >
          MUSIC MINISTRY
        </Link>
        <div className="flex items-center gap-4 md:gap-8 font-bold uppercase tracking-widest text-sm">
          {session ? (
            <div className="flex items-center gap-4">
              <form action={handleLogout}>
                <Button type="submit" variant="outline" size="sm" className="border-2 border-brand-black">Logout</Button>
              </form>
              <Link href="/profile" className="flex items-center gap-2 group">
                <span className="hidden sm:block group-hover:text-brand-pink transition-colors">
                  {(session as any).full_name?.split(' ')[0] || "Profile"}
                </span>
                <Avatar name={(session as any).full_name} imgUrl={(session as any).avatarUrl} className="w-8 h-8 text-xs shadow-[2px_2px_0_0_#111111] group-hover:shadow-none group-hover:translate-x-[2px] group-hover:translate-y-[2px] transition-all" />
              </Link>
            </div>
          ) : (
            <Link href="/login">
              <Button variant="sticker" size="sm">Sign In</Button>
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
