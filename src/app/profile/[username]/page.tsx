import { ProfileScreen } from "@/components/profile-screen";

export default async function ProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ username: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { username } = await params;
  const { tab } = await searchParams;
  return <ProfileScreen username={username} initialTab={tab === "ratings" ? "ratings" : tab === "about" ? "about" : "posts"} />;
}
