export async function POST() {
  return Response.json(
    {
      ok: false,
      message: "管理者セットアップは廃止されました。Supabase Authのサインアップをご利用ください。",
    },
    { status: 410 },
  );
}
