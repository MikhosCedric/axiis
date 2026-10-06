import type { Metadata } from "next";
import { Blank, LegalPage } from "@/components/public/legal";
import { THEME_COOKIE, TZ_COOKIE } from "@/components/shell/cookies";

export const metadata: Metadata = {
  title: "Privacy",
  description: "What Axiis stores about you, who processes it, and how to get it back or delete it.",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy">
      <p>
        This page says what Axiis keeps about you, why, and what you can do about it. It is meant to be read, so it
        is short.
      </p>

      <h2>Who runs Axiis</h2>
      <p>
        Axiis is run by <Blank>Operator name</Blank>, based in <Blank>Country or jurisdiction</Blank>. On this page,
        &ldquo;we&rdquo; means them. You can reach us at <Blank>Contact email</Blank>.
      </p>

      <h2>What we keep</h2>
      <ul>
        <li>
          <strong>Your account.</strong> Your email address. If you sign in with Google, Google also passes on the
          basic profile it shares at sign-in, such as your name and the address of your profile picture, and that is
          kept with your account.
        </li>
        <li>
          <strong>What you make.</strong> The items you create and everything you type into them: titles, times,
          subtasks, areas and the other details you add.
        </li>
        <li>
          <strong>Sign-in records.</strong> Our database provider keeps records of sign-ins and requests, such as
          times and IP addresses, to keep accounts secure. Our hosting provider, <Blank>Hosting provider</Blank>,
          keeps similar request logs.
        </li>
      </ul>
      <p>We use all of this only to run Axiis for you. We do not sell it or share it for advertising.</p>

      <h2>What we do not do</h2>
      <ul>
        <li>No ads.</li>
        <li>No analytics, no tracking pixels, no third-party trackers.</li>
        <li>
          No fonts or scripts loaded from other companies&rsquo; servers. The only outside service your browser talks
          to is our database and sign-in provider, plus Google if you sign in with it.
        </li>
      </ul>

      <h2>Cookies</h2>
      <p>Axiis sets three kinds of cookie, all needed for the app to work as you expect, and no others:</p>
      <ul>
        <li>
          <strong>Session cookies</strong> from our sign-in provider, which keep you signed in.
        </li>
        <li>
          <code>{THEME_COOKIE}</code> remembers whether you chose the light or dark theme. It lasts a year.
        </li>
        <li>
          <code>{TZ_COOKIE}</code> remembers your time zone, so each day starts at your own midnight. It lasts a year.
        </li>
      </ul>

      <h2>Who processes your data</h2>
      <ul>
        <li>
          <strong>Supabase</strong> stores your account and your items, and sends sign-in emails. Data is held in{" "}
          <Blank>Data region, currently Tokyo, Japan</Blank>.
        </li>
        <li>
          <strong>Google</strong>, only if you choose to sign in with Google.
        </li>
        <li>
          <strong>
            <Blank>Hosting provider</Blank>
          </strong>
          , which serves the app.
        </li>
      </ul>

      <h2>Who can see your items</h2>
      <p>
        Every row in the database is tied to your account, and the database itself refuses to show it to any other
        account. The people who run Axiis can reach the database to maintain it. We do not look at your items unless
        you ask us to, or the law requires it.
      </p>

      <h2>Keeping, exporting and deleting</h2>
      <p>
        When you delete an item, it disappears everywhere in the app. It stays in the database, marked as deleted,
        until your account is deleted.
      </p>
      <p>
        Exporting all your data and deleting your account are coming to the settings page. Until they arrive, write to{" "}
        <Blank>Contact email</Blank> and we will send you an export, or delete your account and everything in it,
        within <Blank>Response time, such as 30 days</Blank>.
      </p>

      <h2>Your rights</h2>
      <p>
        Depending on where you live, you may have the right to see, correct, export or delete the data we hold about
        you, and to object to how it is used. Write to <Blank>Contact email</Blank> for any of these. You can also
        complain to your local data protection authority.
      </p>

      <h2>Children</h2>
      <p>
        Axiis is not meant for anyone under <Blank>Minimum age</Blank>.
      </p>

      <h2>Changes to this page</h2>
      <p>
        If we change how we handle your data, we will update this page and its date. For changes that matter, we will
        tell you in the app or by email before they take effect.
      </p>
    </LegalPage>
  );
}
