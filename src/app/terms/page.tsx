import type { Metadata } from "next";
import Link from "next/link";
import { Blank, LegalPage } from "@/components/public/legal";

export const metadata: Metadata = {
  title: "Terms",
  description: "The terms for using Axiis.",
  alternates: { canonical: "/terms" },
};

export default function TermsPage() {
  return (
    <LegalPage title="Terms">
      <p>
        These terms are the agreement between you and <Blank>Operator name</Blank> (&ldquo;we&rdquo;) for using
        Axiis. By creating an account or using the app, you accept them. If you do not, please do not use Axiis.
      </p>

      <h2>The service</h2>
      <p>
        Axiis is a personal planner for tasks and time. It is offered free of charge at present. It is new and still
        changing: features will be added, changed and sometimes removed.
      </p>

      <h2>Your account</h2>
      <ul>
        <li>
          You must be at least <Blank>Minimum age</Blank> to use Axiis.
        </li>
        <li>An account is for one person. Keep access to your email or Google account secure, since that is how you sign in.</li>
        <li>Tell us at <Blank>Contact email</Blank> if you think someone else has got into your account.</li>
      </ul>

      <h2>Your content</h2>
      <p>
        What you put into Axiis stays yours. You give us permission to store it, process it and show it back to you,
        only as far as needed to run the service. The{" "}
        <Link href="/privacy">privacy page</Link> says how we handle it.
      </p>

      <h2>Fair use</h2>
      <p>Do not use Axiis to:</p>
      <ul>
        <li>break the law, or store content that is illegal where you or we are;</li>
        <li>try to reach another person&rsquo;s data, or get around the app&rsquo;s security;</li>
        <li>overload, probe or disrupt the service, including by automated means beyond ordinary personal use.</li>
      </ul>
      <p>We may suspend or close an account that does these things, and will tell you why when we can.</p>

      <h2>Availability</h2>
      <p>
        We work to keep Axiis running and your data safe, but the service is provided as it is, without guarantees of
        being uninterrupted or free of errors. Keep your own copy of anything you cannot afford to lose. If we ever
        decide to shut Axiis down, we will give at least <Blank>Notice period, such as 30 days</Blank> of notice and a
        way to export your data.
      </p>

      <h2>Liability</h2>
      <p>
        To the extent the law allows, we are not liable for indirect or consequential losses, or for loss of data,
        arising from your use of Axiis. Nothing in these terms limits liability that cannot be limited by law.
      </p>

      <h2>Ending</h2>
      <p>
        You can stop using Axiis at any time. Delete your account from the Settings page and it, with everything in
        it, is removed 14 days later, unless you undo it before then. Delete now removes it at once. If you cannot
        sign in, write to <Blank>Contact email</Blank> and we will do it for you.
      </p>

      <h2>Changes</h2>
      <p>
        We may update these terms. We will change the date above, and for changes that matter we will tell you in the
        app or by email before they take effect. Using Axiis after that means you accept the new terms.
      </p>

      <h2>Law</h2>
      <p>
        These terms are governed by the laws of <Blank>Governing law jurisdiction</Blank>.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about these terms go to <Blank>Contact email</Blank>.
      </p>
    </LegalPage>
  );
}
