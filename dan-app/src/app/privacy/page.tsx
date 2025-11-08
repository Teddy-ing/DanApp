const sections = [
  {
    title: "Information We Collect",
    paragraphs: [
      "When you sign in with Google, The RND Group receives your basic Google profile information, including your name, email address, and profile image. We do not collect passwords.",
      "If you provide an API key for RapidAPI, we store an encrypted version of that key to facilitate dividend-adjusted return calculations on your behalf.",
    ],
  },
  {
    title: "How We Use Information",
    paragraphs: [
      "We use your Google identity to authenticate you, personalize your experience, and maintain access to your saved settings.",
      "Your RapidAPI key is used solely to call upstream market data providers in order to compute DRIP-adjusted returns and related analytics that you request through the application.",
    ],
  },
  {
    title: "Data Storage and Security",
    paragraphs: [
      "RapidAPI keys are encrypted before storage and are never sent to the client after you save them. Access to production systems is restricted to authorized personnel of The RND Group.",
      "All traffic is protected using HTTPS, and secure cookies are enforced in production environments to maintain session integrity.",
    ],
  },
  {
    title: "Third-Party Services",
    paragraphs: [
      "Market data is sourced from RapidAPI partners such as Yahoo Finance. Your requests may be routed through those services in accordance with their own privacy policies. We do not sell or rent your personal information to third parties.",
    ],
  },
  {
    title: "Your Choices",
    paragraphs: [
      "You may revoke access to your Google account at any time through your Google security settings. If you wish to delete your account or associated data, contact us using the information below.",
    ],
  },
  {
    title: "Contact",
    paragraphs: [
      "For questions about this Privacy Policy or to request data deletion, email privacy@therndgroup.com.",
    ],
  },
];

export default function PrivacyPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-3xl">
        <article className="rounded-xl border border-black/10 dark:border-white/15 bg-white dark:bg-neutral-900 shadow-sm p-8">
          <header>
            <h1 className="text-3xl font-semibold text-gray-900 dark:text-gray-100">
              Privacy Policy
            </h1>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              Last updated: November 8, 2025
            </p>
          </header>
          <section className="mt-6 space-y-8 text-sm text-gray-800 dark:text-gray-200">
            {sections.map((section) => (
              <div key={section.title} className="space-y-4">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  {section.title}
                </h2>
                {section.paragraphs.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
            ))}
          </section>
        </article>
      </div>
    </div>
  );
}

