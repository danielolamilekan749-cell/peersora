"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Icon, type IconName } from "@/components/icon";
import { usePlatform } from "@/components/platform";

export function Logo({ compact = false, className }: { compact?: boolean; className?: string }) {
  return (
    <Link href="/" className={cn("flex items-center gap-2 text-ink", className)} aria-label="Daylight home">
      <span className="grid h-8 w-8 place-items-center rounded-xl bg-plum text-white">
        <Icon name="cameraBold" size={18} />
      </span>
      {compact ? null : <span className="text-[1.2rem] font-semibold tracking-tight">Daylight</span>}
    </Link>
  );
}

function roleFromCookie() {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/(?:^|; )dl_role=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

export function AppChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { viewer } = usePlatform();
  const [cookieRole, setCookieRole] = useState<string | null>(null);

  useEffect(() => {
    setCookieRole(roleFromCookie());
  }, [viewer, pathname]);

  const role = viewer && viewer.role !== "guest" ? viewer.role : cookieRole;
  if (pathname.startsWith("/admin")) return children;
  if (pathname.startsWith("/join") || pathname.startsWith("/login")) {
    return (
      <div className="min-h-full">
        <header className="sticky top-0 z-40 border-b border-line bg-white/90 backdrop-blur">
          <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
            <Logo />
            <Link href="/" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink">
              <Icon name="back" size={16} /> Back to feed
            </Link>
          </div>
        </header>
        {children}
      </div>
    );
  }
  const creatorSpace =
    pathname.startsWith("/dashboard") ||
    (role === "creator" &&
      (pathname.startsWith("/orders") || pathname.startsWith("/notifications") || pathname.startsWith("/settings")));
  if (creatorSpace) return <DashboardShell>{children}</DashboardShell>;
  return <PublicChrome role={role}>{children}</PublicChrome>;
}

function PublicChrome({ children, role }: { children: ReactNode; role: string | null }) {
  const pathname = usePathname();
  const { unread, viewer, place, setPlace, profiles, askJoin } = usePlatform();
  const [menuOpen, setMenuOpen] = useState(false);
  const places = ["Anywhere", ...Array.from(new Set(profiles.map((profile) => profile.cityLabel).filter((city) => city !== "Location private"))).sort()];
  const signedIn = Boolean(viewer && viewer.role !== "guest") || (!viewer && Boolean(role));
  const isHook = role === "creator";
  const isMember = signedIn && !isHook && role !== "admin";
  const accountHref = !signedIn
    ? "/login"
    : role === "admin"
      ? "/admin"
      : isHook
        ? viewer?.username
          ? `/profile/${viewer.username}`
          : "/join?as=hook"
        : "/me";
  const accountActive = !signedIn
    ? pathname.startsWith("/login")
    : pathname.startsWith("/me") || pathname.startsWith("/settings") || pathname.startsWith("/join") || (viewer?.username ? pathname === `/profile/${viewer.username}` : false);
  const isHome = pathname === "/";
  const isSearch = pathname.startsWith("/explore");
  const isSaved = pathname.startsWith("/saved");
  const isAlerts = pathname.startsWith("/notifications");

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  const cols = isMember || role === "admin" ? "grid-cols-4" : "grid-cols-5";

  return (
    <div className="min-h-full bg-canvas lg:pl-[76px]">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[76px] flex-col items-center border-r border-line bg-white py-4 lg:flex">
        <Link href="/" aria-label="Daylight home" className="press grid h-11 w-11 place-items-center rounded-2xl bg-plum text-white">
          <Icon name="cameraBold" size={22} />
        </Link>
        <nav className="mt-5 flex flex-1 flex-col items-center gap-1">
          <RailLink href="/" label="Home" active={isHome} icon="home" activeIcon="homeBold" />
          <RailLink href="/explore" label="Search" active={isSearch} icon="search" activeIcon="searchBold" />
          <RailLink href="/notifications" label="Notifications" active={isAlerts} icon="heart" activeIcon="heartBold" badge={unread} />
          <RailLink href="/saved" label="Saved" active={isSaved} icon="bookmark" activeIcon="bookmarkBold" />
          {!signedIn ? (
            <button type="button" aria-label="Join" title="Join" onClick={askJoin} className="press grid h-12 w-12 place-items-center rounded-2xl text-ink/80 hover:bg-canvas hover:text-ink">
              <Icon name="add" size={26} />
            </button>
          ) : isHook ? (
            <RailLink href="/dashboard/posts?new=1" label="New post" active={false} icon="add" activeIcon="addBold" />
          ) : null}
          {signedIn ? (
            <RailLink href={accountHref} label="Profile" active={accountActive} icon="user" activeIcon="userBold" />
          ) : (
            <button type="button" aria-label="Profile" title="Profile" onClick={askJoin} className="press grid h-12 w-12 place-items-center rounded-2xl text-ink/80 hover:bg-canvas hover:text-ink">
              <Icon name="user" size={26} />
            </button>
          )}
        </nav>
        <div className="relative">
          <button
            type="button"
            aria-label="Menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
            className={cn("press grid h-12 w-12 place-items-center rounded-2xl text-ink hover:bg-canvas", menuOpen && "bg-canvas")}
          >
            <Icon name="menu" size={26} />
          </button>
          {menuOpen ? (
            <div className="fade-up absolute bottom-0 left-14 z-50 w-64 rounded-2xl bg-white p-2 text-sm shadow-float ring-1 ring-line">
              <label className="block px-2 pb-2 pt-1">
                <span className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted"><Icon name="pin" size={14} /> Location</span>
                <select value={place} onChange={(event) => setPlace(event.target.value)} className="h-10 w-full rounded-xl bg-canvas px-3 outline-none ring-1 ring-transparent focus:ring-plum">
                  {places.map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
              </label>
              <div className="grid gap-0.5">
                <MenuLink href={signedIn ? "/settings" : "/login"} icon={signedIn ? "settings" : "login"}>{signedIn ? "Settings" : "Sign in"}</MenuLink>
                {isMember ? <MenuLink href="/orders" icon="clipboard">My orders</MenuLink> : null}
                <MenuLink href="/guidelines" icon="shield">Guidelines</MenuLink>
                <MenuLink href="/terms" icon="document">Terms</MenuLink>
                <MenuLink href="/privacy" icon="lock">Privacy</MenuLink>
              </div>
            </div>
          ) : null}
        </div>
      </aside>

      <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-line bg-white/95 px-4 backdrop-blur lg:hidden">
        <Logo />
        <Link href="/notifications" aria-label="Notifications" className="press relative grid h-10 w-10 place-items-center rounded-full text-ink hover:bg-canvas">
          <Icon name="heart" size={23} />
          {unread > 0 ? <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-plum ring-2 ring-white" /> : null}
        </Link>
      </header>

      <div className="mx-auto w-full max-w-6xl px-3 pb-24 sm:px-4 lg:mx-0 lg:ml-8 lg:mr-auto lg:min-h-screen lg:max-w-[1080px] lg:px-2 lg:pb-16 lg:pt-6">
        {children}
        <footer className="px-1 py-8 text-center text-[11px] leading-5 text-muted">
          <p>Adults 18+ only. Sample profiles are previews, not verified members.</p>
          <p className="mt-2 flex flex-wrap justify-center gap-x-3">
            <Link href="/guidelines" className="hover:text-ink">Guidelines</Link>
            <Link href="/terms" className="hover:text-ink">Terms</Link>
            <Link href="/privacy" className="hover:text-ink">Privacy</Link>
          </p>
        </footer>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white/95 backdrop-blur lg:hidden" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        <div className={cn("mx-auto grid h-14 max-w-lg", cols)}>
          <Tab href="/" label="Home" active={isHome} icon="home" activeIcon="homeBold" />
          <Tab href="/explore" label="Search" active={isSearch} icon="search" activeIcon="searchBold" />
          {!signedIn ? <TabButton label="Join" icon="addCircle" onClick={askJoin} /> : null}
          {isHook ? <Tab href="/dashboard/posts?new=1" label="Post" active={false} icon="addCircle" activeIcon="addCircle" accent /> : null}
          <Tab href="/saved" label="Saved" active={isSaved} icon="bookmark" activeIcon="bookmarkBold" />
          {signedIn ? (
            <Tab href={accountHref} label="Profile" active={accountActive} icon="user" activeIcon="userBold" />
          ) : (
            <TabButton label="Profile" icon="user" onClick={askJoin} muted />
          )}
        </div>
      </nav>
    </div>
  );
}

function RailLink({ href, label, active, icon, activeIcon, badge = 0 }: { href: string; label: string; active: boolean; icon: IconName; activeIcon: IconName; badge?: number }) {
  return (
    <Link href={href} aria-label={label} title={label} aria-current={active ? "page" : undefined} className={cn("press relative grid h-12 w-12 place-items-center rounded-2xl", active ? "text-ink" : "text-ink/80 hover:bg-canvas hover:text-ink")}>
      <Icon name={active ? activeIcon : icon} size={26} />
      {badge > 0 ? <Count value={badge} className="right-1.5 top-1.5" /> : null}
    </Link>
  );
}

function Count({ value, className }: { value: number; className?: string }) {
  return <span className={cn("absolute grid h-[18px] min-w-[18px] place-items-center rounded-full bg-plum px-1 text-[10px] font-semibold text-white ring-2 ring-white", className)}>{value > 9 ? "9+" : value}</span>;
}

function MenuLink({ href, icon, children }: { href: string; icon: IconName; children: ReactNode }) {
  return (
    <Link href={href} className="flex items-center gap-2.5 rounded-xl px-2.5 py-2 hover:bg-canvas">
      <Icon name={icon} size={18} className="text-muted" />
      {children}
    </Link>
  );
}

function Tab({ href, label, active, icon, activeIcon, badge = 0, accent = false }: { href: string; label: string; active: boolean; icon: IconName; activeIcon: IconName; badge?: number; accent?: boolean }) {
  return (
    <Link href={href} aria-current={active ? "page" : undefined} className={cn("relative flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium", active || accent ? "text-plum" : "text-ink/75")}>
      <span className="relative">
        <Icon name={active ? activeIcon : icon} size={accent ? 28 : 24} />
        {badge > 0 ? <span className="absolute -right-1 -top-0.5 h-2 w-2 rounded-full bg-plum ring-2 ring-white" /> : null}
      </span>
      {label}
    </Link>
  );
}

function TabButton({ label, icon, onClick, muted = false }: { label: string; icon: IconName; onClick: () => void; muted?: boolean }) {
  return (
    <button type="button" onClick={onClick} className={cn("relative flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium", muted ? "text-ink/75" : "text-plum")}>
      <Icon name={icon} size={muted ? 24 : 28} />
      {label}
    </button>
  );
}

const creatorLinks: { href: string; label: string; icon: IconName; activeIcon: IconName }[] = [
  { href: "/dashboard", label: "Overview", icon: "dashboard", activeIcon: "dashboardBold" },
  { href: "/dashboard/profile", label: "My profile", icon: "user", activeIcon: "userBold" },
  { href: "/dashboard/posts", label: "My posts", icon: "gallery", activeIcon: "galleryBold" },
  { href: "/orders", label: "Orders", icon: "clipboard", activeIcon: "clipboardBold" },
  { href: "/notifications", label: "Notifications", icon: "bell", activeIcon: "bellBold" },
  { href: "/settings", label: "Settings", icon: "settings", activeIcon: "settingsBold" },
];

export function DashboardShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { unread, viewer } = usePlatform();
  return (
    <div className="min-h-full md:grid md:grid-cols-[248px_1fr]">
      <aside className="sticky top-0 hidden h-screen flex-col border-r border-line bg-white px-4 py-5 md:flex">
        <Logo />
        <nav className="mt-8 flex flex-1 flex-col gap-1">
          {creatorLinks.map((link) => {
            const active = link.href === "/dashboard" ? pathname === link.href : pathname.startsWith(link.href);
            return (
              <Link key={link.href} href={link.href} aria-current={active ? "page" : undefined} className={cn("press flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium", active ? "bg-rose text-plum" : "text-ink/85 hover:bg-canvas")}>
                <Icon name={active ? link.activeIcon : link.icon} size={20} />
                {link.label}
                {link.href === "/notifications" && unread > 0 ? <span className="ml-auto grid h-5 min-w-5 place-items-center rounded-full bg-plum px-1.5 text-[11px] font-semibold text-white">{unread}</span> : null}
              </Link>
            );
          })}
        </nav>
        {viewer?.username ? (
          <Link href={`/profile/${viewer.username}`} className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-muted hover:bg-canvas hover:text-ink">
            <Icon name="user" size={18} /> View my profile
          </Link>
        ) : null}
        <Link href="/" className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-muted hover:bg-canvas hover:text-ink">
          <Icon name="home" size={18} /> Back to feed
        </Link>
      </aside>
      <div className="min-w-0">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line bg-white/95 px-4 backdrop-blur md:hidden">
          <Logo />
          <Link href="/" className="text-sm font-medium text-muted">Back to feed</Link>
        </header>
        <div className="mx-auto max-w-5xl px-4 py-5 pb-24 sm:px-6 md:py-8 md:pb-10">{children}</div>
      </div>
      <nav className="fixed inset-x-0 bottom-0 z-40 grid h-14 grid-cols-5 border-t border-line bg-white/95 backdrop-blur md:hidden" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        <Tab href="/dashboard" label="Home" active={pathname === "/dashboard"} icon="dashboard" activeIcon="dashboardBold" />
        <Tab href="/dashboard/posts" label="Posts" active={pathname.startsWith("/dashboard/posts")} icon="gallery" activeIcon="galleryBold" />
        <Tab href="/orders" label="Orders" active={pathname.startsWith("/orders")} icon="clipboard" activeIcon="clipboardBold" />
        <Tab href="/notifications" label="Alerts" active={pathname.startsWith("/notifications")} icon="bell" activeIcon="bellBold" badge={unread} />
        <Tab href="/settings" label="Settings" active={pathname.startsWith("/settings")} icon="settings" activeIcon="settingsBold" />
      </nav>
    </div>
  );
}
