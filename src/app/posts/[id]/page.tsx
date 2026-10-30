import { PostScreen } from "@/components/post-screen";

export default async function PostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PostScreen id={id} />;
}
