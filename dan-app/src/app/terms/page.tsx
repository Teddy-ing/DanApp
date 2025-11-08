const sections = [
  {
    title: "1. Acceptance of Terms",
    paragraphs: [
      "The RND Group (“we”, “us”, or “our”) provides access to websites, applications, data, tools, and services (collectively, the “Services”). By accessing or using the Services, you acknowledge that you have read, understood, and agree to be bound by these Terms of Service (“Terms”) and all applicable laws and regulations. If you do not agree with these Terms, you may not access or use the Services.",
      "We may update these Terms at any time by posting a revised version within the Services. Your continued use of the Services after any update constitutes your acceptance of the revised Terms.",
    ],
  },
  {
    title: "2. Eligibility and Registration",
    paragraphs: [
      "You represent and warrant that you are at least eighteen (18) years of age and have the legal capacity to enter into a binding agreement. To access certain features, you may be required to create an account and provide accurate, current, and complete information. You agree to maintain and promptly update your account information, and you are responsible for safeguarding your credentials and for all activities that occur under your account.",
    ],
  },
  {
    title: "3. License and Permitted Use",
    paragraphs: [
      "Subject to your compliance with these Terms, The RND Group grants you a limited, revocable, non-exclusive, non-transferable license to access and use the Services for your personal, non-commercial purposes. You agree not to reproduce, distribute, modify, create derivative works of, publicly display, or otherwise exploit the Services without our express written permission.",
    ],
    list: [
      "Reverse engineer, decompile, or disassemble any portion of the Services.",
      "Use data mining, robots, or similar data gathering or extraction methods.",
      "Upload or transmit viruses, worms, or other malicious code.",
      "Attempt to gain unauthorized access to the Services or related systems.",
    ],
    listLabel: "You will not:",
  },
  {
    title: "4. Market Data and Third-Party Content",
    paragraphs: [
      "Certain data and content available through the Services are provided by third parties and are subject to additional terms and restrictions. You agree not to redistribute, reproduce, or otherwise use third-party content except as expressly permitted. The RND Group does not guarantee the accuracy, completeness, timeliness, or availability of any third-party data and shall not be liable for any reliance on such content.",
    ],
  },
  {
    title: "5. User Conduct",
    paragraphs: [
      "You agree to use the Services in compliance with all applicable laws and regulations. You are solely responsible for any content you submit, upload, or transmit through the Services, and you represent that you have all necessary rights to do so. The RND Group reserves the right to remove any content that violates these Terms or that we deem objectionable in our sole discretion.",
    ],
  },
  {
    title: "6. Proprietary Rights",
    paragraphs: [
      "All content, trademarks, service marks, trade names, logos, and intellectual property rights associated with the Services are the property of The RND Group or its licensors. Except as expressly provided in these Terms, nothing in the Services grants you any license or right to use any intellectual property without prior written permission.",
    ],
  },
  {
    title: "7. Disclaimer of Warranties",
    paragraphs: [
      "THE SERVICES ARE PROVIDED ON AN “AS IS” AND “AS AVAILABLE” BASIS WITHOUT WARRANTIES OF ANY KIND, WHETHER EXPRESS, IMPLIED, OR STATUTORY. THE RND GROUP EXPRESSLY DISCLAIMS ANY IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, TITLE, AND NON-INFRINGEMENT. WE DO NOT WARRANT THAT THE SERVICES WILL BE UNINTERRUPTED, ERROR-FREE, OR FREE OF HARMFUL COMPONENTS, OR THAT ANY DEFECTS WILL BE CORRECTED.",
    ],
  },
  {
    title: "8. Limitation of Liability",
    paragraphs: [
      "TO THE MAXIMUM EXTENT PERMITTED BY LAW, IN NO EVENT SHALL THE RND GROUP, ITS AFFILIATES, DIRECTORS, EMPLOYEES, AGENTS, OR LICENSORS BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR FOR ANY LOSS OF PROFITS, REVENUE, DATA, OR USE, ARISING OUT OF OR RELATED TO YOUR ACCESS TO OR USE OF THE SERVICES, WHETHER BASED ON WARRANTY, CONTRACT, TORT (INCLUDING NEGLIGENCE), OR ANY OTHER LEGAL THEORY, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.",
      "Our total liability for any claim arising out of or relating to the Services is limited to the amount paid, if any, by you to The RND Group in the twelve (12) months preceding the claim.",
    ],
  },
  {
    title: "9. Indemnification",
    paragraphs: [
      "You agree to defend, indemnify, and hold harmless The RND Group and its officers, directors, employees, agents, and licensors from and against any and all claims, liabilities, damages, losses, and expenses, including reasonable attorneys’ fees, arising out of or in any way connected with your access to or use of the Services, your violation of these Terms, or your infringement of any third-party right.",
    ],
  },
  {
    title: "10. Termination",
    paragraphs: [
      "The RND Group may suspend or terminate your access to the Services at any time, with or without notice, for any reason, including if we reasonably believe you have violated these Terms. Upon termination, the rights and licenses granted to you herein will cease immediately, and you must stop using the Services.",
    ],
  },
  {
    title: "11. Governing Law and Venue",
    paragraphs: [
      "These Terms and any disputes arising out of or relating to the Services shall be governed by and construed in accordance with the laws of the State of Illinois, without regard to its conflict of law principles. You agree to submit to the exclusive jurisdiction of the state and federal courts located in Cook County, Illinois, for the resolution of any legal matter arising from these Terms.",
    ],
  },
  {
    title: "12. Contact Information",
    paragraphs: [
      "If you have any questions about these Terms, please contact The RND Group at legal@therndgroup.com or by mail at 123 Market Street, Suite 500, Chicago, IL 60606.",
    ],
  },
];

export default function TermsPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-4xl">
        <article className="rounded-xl border border-black/10 dark:border-white/15 bg-white dark:bg-neutral-900 shadow-sm p-8">
          <header>
            <h1 className="text-3xl font-semibold text-gray-900 dark:text-gray-100">
              Terms of Service
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
                {section.list && (
                  <div className="space-y-2">
                    {section.listLabel && <p>{section.listLabel}</p>}
                    <ul className="list-disc ml-6 space-y-1">
                      {section.list.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </section>
        </article>
      </div>
    </div>
  );
}

