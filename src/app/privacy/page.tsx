export const metadata = { title: "Privacy" };

export default function PrivacyPage() {
  return (
    <article className="mx-auto max-w-2xl space-y-4 py-6 text-sm leading-7">
      <h1 className="text-3xl font-semibold tracking-tight">Privacy policy</h1>
      <p>Public profiles show the name, photos, bio, interests, and location detail you choose. Email addresses and phone numbers are never published. Hooks give a phone number when they join, and only Daylight staff can see it.</p>
      <p>Hooks type their own location. Exact addresses are never shown.</p>
      <p>Orders are visible only to the user who placed them and the hook who received them. Reported content may be reviewed by administrators in a limited snippet.</p>
      <p>You sign in with Google, so Daylight never stores a password.</p>
      <p>You can delete your account at any time, which removes it from discovery.</p>
    </article>
  );
}
