export function ageFromDob(dob: string, now = new Date()) {
  const date = new Date(`${dob}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  let age = now.getFullYear() - date.getFullYear();
  const month = now.getMonth() - date.getMonth();
  if (month < 0 || (month === 0 && now.getDate() < date.getDate())) age -= 1;
  return age;
}

export function formatWhen(iso: string) {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const delta = Date.now() - then;
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (delta < minute) return "Just now";
  if (delta < hour) return `${Math.floor(delta / minute)}m`;
  if (delta < day) return `${Math.floor(delta / hour)}h`;
  if (delta < 7 * day) return `${Math.floor(delta / day)}d`;
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
  }).format(new Date(iso));
}

export function formatLongDate(iso: string) {
  return new Intl.DateTimeFormat("en", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(iso));
}

export function cityLabelOf(profile: {
  locationPrivacy: "city" | "region" | "hidden";
  city: string;
  region: string;
}) {
  if (profile.locationPrivacy === "hidden") return "Location private";
  if (profile.locationPrivacy === "region") return profile.region;
  return profile.city;
}

export function isRecentlyJoined(iso: string, now = Date.now()) {
  return now - new Date(iso).getTime() < 30 * 24 * 60 * 60 * 1000;
}
