export const metadata = { title: "Privacy" };

export default function PrivacyPage() {
  return (
    <article className="mx-auto max-w-2xl space-y-4 py-6 text-sm leading-7">
      <h1 className="text-3xl font-semibold tracking-tight">Privacy policy</h1>
      <p>Public profiles show the name, photos, bio, interests, and location detail you choose. Email addresses, phone numbers, and dates of birth are not published.</p>
      <p>Exact location is optional. You can show a city, a region, or nothing.</p>
      <p>Orders are visible only to the user who placed them and the hook who received them. Reported content may be reviewed by administrators in a limited snippet.</p>
      <p>Password resets and account recovery should be connected to your email provider when Supabase Auth is configured. This local preview stores accounts in a private server file, not in the browser.</p>
      <p>You can download nothing automatically in this preview build. You can delete the account, which removes it from discovery.</p>
    </article>
  );
}
