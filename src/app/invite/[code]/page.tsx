import { InviteView } from "@/components/views/invite-view";

export default async function InvitePage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;

  return <InviteView code={code} />;
}
