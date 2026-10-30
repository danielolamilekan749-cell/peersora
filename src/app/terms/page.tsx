export const metadata = { title: "Terms" };

export default function TermsPage() {
  return (
    <article className="mx-auto max-w-2xl space-y-4 py-6 text-sm leading-7">
      <h1 className="text-3xl font-semibold tracking-tight">Terms of use</h1>
      <p>By creating an account you confirm that you are at least 18 years old and that the details you provide are your own.</p>
      <p>Hook profiles stay private until age and identity checks are approved. Daylight may refuse, hide, or suspend any profile, post, comment, order, or rating that breaks the community guidelines.</p>
      <p>You keep ownership of the photos you upload. You give Daylight permission to display them according to the visibility you choose, and to review them for safety.</p>
      <p>Orders are requests, not obligations. A hook may accept or decline any order, and users may cancel an open order at any time.</p>
      <p>You may deactivate or delete your account from Settings. Deletion removes the public profile. Some moderation records may be kept where the law or a safety investigation requires it.</p>
    </article>
  );
}
