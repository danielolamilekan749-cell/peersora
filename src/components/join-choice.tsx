"use client";

import Link from "next/link";
import { Icon, type IconName } from "@/components/icon";

const options: { as: "user" | "hook"; title: string; body: string; icon: IconName }[] = [
  { as: "user", title: "I'm a user", body: "Browse profiles, save posts, order and rate.", icon: "user" },
  { as: "hook", title: "I'm a hook", body: "Create a profile, post, and take orders.", icon: "camera" },
];

export function JoinChoice({ onPick }: { onPick?: () => void }) {
  return (
    <div className="grid gap-2.5">
      {options.map((option) => (
        <Link
          key={option.as}
          href={`/join?as=${option.as}`}
          onClick={onPick}
          className="press group flex items-center gap-3.5 rounded-2xl bg-white p-3.5 ring-1 ring-line hover:ring-2 hover:ring-plum"
        >
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-rose text-plum">
            <Icon name={option.icon} size={24} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-semibold">{option.title}</span>
            <span className="block text-[13px] leading-5 text-muted">{option.body}</span>
          </span>
          <Icon name="forward" size={18} className="text-muted group-hover:text-plum" />
        </Link>
      ))}
    </div>
  );
}
