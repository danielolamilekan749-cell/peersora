"use client";

import { useEffect, useRef, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Icon, type IconName } from "@/components/icon";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "outline" | "ghost" | "danger" | "soft";
  size?: "sm" | "md";
  loading?: boolean;
};

export function Button({ variant = "primary", size = "md", className, type = "button", loading = false, disabled, children, ...props }: ButtonProps) {
  return (
    <button
      type={type}
      disabled={loading || disabled}
      aria-busy={loading || undefined}
      className={cn(
        "press inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full font-semibold disabled:cursor-not-allowed disabled:opacity-50",
        size === "sm" ? "h-9 px-4 text-[13px]" : "h-11 px-5 text-sm",
        variant === "primary" && "bg-plum text-white shadow-[0_6px_16px_-8px_rgb(31_138_76/0.7)] hover:bg-plum-deep",
        variant === "soft" && "bg-rose text-plum hover:bg-[#d9eee0]",
        variant === "outline" && "bg-white text-ink ring-1 ring-line hover:bg-canvas",
        variant === "ghost" && "text-ink hover:bg-rose/70",
        variant === "danger" && "bg-white text-danger ring-1 ring-line hover:bg-[#fbf1ef]",
        className,
      )}
      {...props}
    >
      {loading ? <Spinner size={size === "sm" ? 14 : 16} /> : null}
      {children}
    </button>
  );
}

/** Inline SVG spinner — zero extra deps, animated via Tailwind animate-spin */
export function Spinner({ size = 16, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden className={cn("animate-spin", className)}>
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeDasharray="28" strokeDashoffset="10" opacity="0.25" />
      <path d="M8 2a6 6 0 0 1 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function IconButton({
  icon,
  label,
  size = 22,
  className,
  active = false,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { icon: IconName; label: string; size?: number; active?: boolean }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn("press grid h-10 w-10 place-items-center rounded-full text-ink hover:bg-canvas", active && "text-plum", className)}
      {...props}
    >
      <Icon name={icon} size={size} />
    </button>
  );
}

export const controlClass =
  "h-11 w-full rounded-xl bg-white px-3.5 text-sm text-ink outline-none ring-1 ring-line transition placeholder:text-muted/70 focus:ring-2 focus:ring-plum";

export function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-medium text-ink">{label}</span>
      {children}
      {error ? <span className="mt-1.5 block text-xs text-danger">{error}</span> : null}
      {!error && hint ? <span className="mt-1.5 block text-xs leading-5 text-muted">{hint}</span> : null}
    </label>
  );
}

export function Switch({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      type="checkbox"
      className={cn(
        "relative h-6 w-10 shrink-0 cursor-pointer appearance-none rounded-full bg-line transition before:absolute before:left-0.5 before:top-0.5 before:h-5 before:w-5 before:rounded-full before:bg-white before:shadow before:transition checked:bg-plum checked:before:translate-x-4",
        className,
      )}
      {...props}
    />
  );
}

export function Chip({ children, active = false, className, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      type="button"
      className={cn(
        "press inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-medium",
        active ? "bg-ink text-white" : "bg-white text-ink ring-1 ring-line hover:bg-canvas",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function Tag({ children, tone = "soft", className }: { children: ReactNode; tone?: "soft" | "muted" | "success" | "white"; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
        tone === "soft" && "bg-rose text-plum",
        tone === "muted" && "bg-canvas text-muted",
        tone === "success" && "bg-rose text-success",
        tone === "white" && "bg-white/90 text-ink shadow-sm",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Dialog({ open, title, onClose, children, wide = false }: { open: boolean; title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={title}>
      <button className="absolute inset-0 bg-ink/40 backdrop-blur-[2px]" aria-label="Close dialog" onClick={onClose} />
      <div className={cn("fade-up relative max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 shadow-float sm:rounded-3xl sm:p-6", wide ? "sm:max-w-3xl" : "sm:max-w-md")}>
        <span className="mx-auto mb-3 block h-1 w-10 rounded-full bg-line sm:hidden" />
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 className="text-lg font-semibold leading-tight">{title}</h2>
          <IconButton icon="close" label="Close" onClick={onClose} className="-mr-2 -mt-1 h-9 w-9" />
        </div>
        {children}
      </div>
    </div>
  );
}

export function Menu({ label, children, align = "right" }: { label: string; children: ReactNode; align?: "right" | "left" }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", close);
    return () => window.removeEventListener("mousedown", close);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="press grid h-9 w-9 place-items-center rounded-full text-ink hover:bg-canvas"
      >
        <Icon name="more" size={20} />
      </button>
      {open ? (
        <div
          className={cn("fade-up absolute z-20 mt-1 w-52 rounded-2xl bg-white p-1.5 text-left shadow-float ring-1 ring-line", align === "right" ? "right-0" : "left-0")}
          onClick={() => setOpen(false)}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}

export function MenuItem({ children, onClick, danger = false, icon }: { children: ReactNode; onClick: () => void; danger?: boolean; icon?: IconName }) {
  return (
    <button type="button" onClick={onClick} className={cn("flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm hover:bg-canvas", danger && "text-danger")}>
      {icon ? <Icon name={icon} size={18} className={danger ? "text-danger" : "text-muted"} /> : null}
      {children}
    </button>
  );
}

export function EmptyState({ title, body, action, icon = "sparkle" }: { title: string; body: string; action?: ReactNode; icon?: IconName }) {
  return (
    <div className="card px-6 py-12 text-center">
      <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-rose text-plum">
        <Icon name={icon} size={24} />
      </span>
      <h2 className="mt-4 text-lg font-semibold">{title}</h2>
      <p className="mx-auto mt-1.5 max-w-md text-sm leading-6 text-muted">{body}</p>
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-2xl bg-line/80", className)} />;
}

export function PageTitle({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-[1.75rem]">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-muted">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function Avatar({ src, alt = "", size = 40, ring = false, className }: { src?: string | null; alt?: string; size?: number; ring?: boolean; className?: string }) {
  return (
    <span className={cn("relative inline-block shrink-0 overflow-hidden rounded-full bg-rose", ring && "story-ring p-[2px]", className)} style={{ width: size, height: size }}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={alt} className={cn("h-full w-full rounded-full object-cover", ring && "border-2 border-white")} />
      ) : (
        <span className="grid h-full w-full place-items-center text-plum">
          <Icon name="userRounded" size={Math.round(size * 0.55)} />
        </span>
      )}
    </span>
  );
}
