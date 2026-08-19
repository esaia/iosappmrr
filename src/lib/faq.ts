import { dofollow } from '@/lib/dofollow'
import { CONNECTABLE_PROVIDERS } from '@/lib/providers'
import { site } from '@/lib/site'
import { formatMoney } from '@/lib/utils'

export type FaqItem = {
  question: string
  /** Plain paragraphs. No markup: the same strings are emitted as JSON-LD. */
  answer: string[]
  /** Optional "read more" pointer, rendered after the answer. */
  link?: { href: string; label: string }
}

export type FaqSection = {
  heading: string
  items: FaqItem[]
}

/**
 * The FAQ, as data rather than markup, so the page and its FAQPage schema are
 * built from one source and cannot drift apart. Nothing here is a link or a
 * fragment of JSX for the same reason — a rich result that says something the
 * page does not is exactly the kind of thing that gets a site's schema ignored.
 *
 * A function, not a constant, because the answers quote the live provider list
 * and the live upgrade price. Both would otherwise be numbers typed twice, and
 * an FAQ that quotes yesterday's price is worse than no FAQ. That import chain
 * reaches Node built-ins, so this is server-side only — which is where the FAQ
 * page renders anyway.
 *
 * Only claims the site can stand behind: no marketplace answers written as if
 * the marketplace were open, no visitor counts, no domain authority.
 */
export function faqSections(): FaqSection[] {
  const providerNames = CONNECTABLE_PROVIDERS.map((provider) => provider.name)
  const providers =
    providerNames.length > 1
      ? `${providerNames.slice(0, -1).join(', ')} and ${providerNames.at(-1)}`
      : providerNames.join('')

  return [
    {
      heading: 'Getting started',
      items: [
        {
          question: `What is ${site.name}?`,
          answer: [
            `${site.name} is an index of App Store apps whose revenue is read directly from the payment provider that collects it. Every figure on the site was pulled from ${providers} by a scheduled job — none of it was typed in by a founder.`,
            'That restriction is the whole product. There is no self-reported tier, no estimate, and no scraped number, so a ranking here is a ranking of what apps actually earn rather than what their owners are willing to claim.',
          ],
          link: { href: '/about', label: 'About this site' },
        },
        {
          question: 'Do I need an account to browse?',
          answer: [
            'No. The leaderboard, every app page, the categories and the stats are open to anyone, signed in or not.',
            'You only need an account to add an app of your own and manage it afterwards.',
          ],
        },
        {
          question: 'What does it cost to list my app?',
          answer: [
            'Nothing. Listing an app, connecting a provider, and keeping the listing updated are free, and always have been.',
            `The only paid upgrade is an optional dofollow link back to your site, ${formatMoney(dofollow.priceCents)} once. It does not affect your ranking, your badge, or your figure.`,
          ],
        },
        {
          question: 'How do I add my app?',
          answer: [
            'Paste your App Store link. We read Apple’s public catalogue for the icon, screenshots, rating, category and version, so you are not retyping what Apple already knows.',
            'Then pick a category, add what you built it with, and connect a read-only key from your payment provider. It takes about two minutes, and the listing goes live once the key returns a figure.',
          ],
          link: { href: '/submit', label: 'Add your app' },
        },
        {
          question: 'Which payment providers can I connect?',
          answer: [
            `${providers}. Both are read through the narrowest credential each one offers, and each connection is tested before it is stored.`,
            'Stripe and other web billing providers are deliberately not offered: this is an index of App Store revenue, and mixing web checkout into the same figure would make the comparison between two listings meaningless.',
          ],
          link: { href: '/verification', label: 'How we verify' },
        },
        {
          question: 'Why can I not connect Superwall?',
          answer: [
            'Superwall issues public SDK keys only and publishes no API for reading revenue, so there is no way for us to check a figure through it.',
            'We would rather list nothing than a badge we cannot stand behind. If that changes, we will add it.',
          ],
        },
        {
          question: 'Can I claim an app that is already listed?',
          answer: [
            'There is nothing to claim. Every listing on the site was added by the founder who connected its provider key, so the site holds no unclaimed or scraped profiles.',
            `If you find your app here and you did not add it, message me on X at @${site.x.handle} and we will sort it out.`,
          ],
          link: { href: site.x.url, label: `@${site.x.handle} on X` },
        },
        {
          question: 'Can I list my app without naming it?',
          answer: [
            'Yes. Anonymous mode withholds the name, the icon, the App Store link and the screenshots, so the app cannot be identified from its listing.',
            'What stays is the founder and the verified revenue. Somebody has to stand behind a number for it to mean anything, so stealth covers the app rather than the person.',
          ],
        },
        {
          question: 'Can I edit or delete my listing?',
          answer: [
            'Both, from your dashboard. The name, tagline, description, category, website and tech stack are yours to edit at any time.',
            'Deleting removes the listing and frees the App Store link for someone to list again later.',
          ],
        },
      ],
    },
    {
      heading: 'Verification, keys and privacy',
      items: [
        {
          question: 'What can the key I connect actually do?',
          answer: [
            'It reads. Each provider’s instructions ask for the narrowest credential it offers, and the key is tested against a live call the moment you paste it — a key that does not work is never stored.',
            'Nothing here can charge a customer, issue a refund, or change anything in your provider account.',
          ],
        },
        {
          question: 'Where are the keys stored?',
          answer: [
            'Encrypted with AES-256-GCM using a key held only by the server, in a table no browser session can read.',
            'You cannot read yours back either. Reconnecting always means entering the credential again, which is the point.',
          ],
        },
        {
          question: 'What data do you read from my provider?',
          answer: [
            'Aggregate revenue and subscription figures only — what the app earned, and how many active subscriptions stand behind it.',
            'No customer names, emails, or individual transactions are read or stored.',
          ],
        },
        {
          question: 'How often do the numbers refresh?',
          answer: [
            'Every active connection is re-read daily and written to an append-only history, which is what draws the chart on each app page. Every profile shows when it last synced, so you can judge freshness yourself rather than take ours on trust.',
            'App Store Connect publishes sales data a day behind, so apps verified that way show a "data as of" date rather than today’s.',
          ],
        },
        {
          question: 'Why does my figure here differ from my provider dashboard?',
          answer: [
            'Providers each define their own headline metrics, and we do not copy a dashboard tile — revenue is normalised to a monthly figure so that two apps billing in different ways can sit in the same ranking.',
            'Currency conversion, how a provider reports refunds and chargebacks, and App Store Connect’s reporting lag all move the two numbers apart. If yours looks wrong rather than merely different, tell us.',
          ],
        },
        {
          question: 'Can I connect more than one provider?',
          answer: [
            'Yes. An app billing through both in-app purchase and a second source can connect both.',
            'Each connection is stored separately and the day’s figures are summed once, so adding a second provider cannot inflate a number by counting the same revenue twice.',
          ],
        },
        {
          question: 'What does the verified badge not prove?',
          answer: [
            'It confirms that a provider account reports this revenue. It does not audit the business behind it.',
            'It cannot tell you whether refunds and chargebacks were fully deducted, whether the connected account covers only the app shown, or anything about profit. Every figure on the site is revenue, before Apple’s cut and before costs.',
          ],
          link: { href: '/verification', label: 'The method, and its limits' },
        },
        {
          question: 'What happens if I disconnect my provider?',
          answer: [
            'Revenue stops refreshing, and if it was the last active connection the listing is hidden from the site rather than left standing on a stale number.',
            'Reconnecting brings it back. A verified badge is a claim about today, so it does not outlive the connection that earns it.',
          ],
        },
      ],
    },
    {
      heading: 'What is on an app page',
      items: [
        {
          question: 'Which numbers does a profile show?',
          answer: [
            'Monthly revenue, active subscriptions, growth over the last 30 and 90 days, and a chart of every daily figure we have recorded.',
            'Alongside them sit the App Store facts — rating, category, version and screenshots — read from Apple’s public catalogue.',
          ],
        },
        {
          question: 'What is the listing quality (ASO) score?',
          answer: [
            'A score out of 100 for how well the App Store listing itself is built, computed from the public catalogue.',
            'It is deliberately not called a rank. Apple does not expose the subtitle, the keyword field or conversion rate publicly, so a rank claimed from this data would be a guess dressed up as a measurement.',
          ],
        },
        {
          question: 'What is the "Can I vibecode it?" verdict?',
          answer: [
            'A model’s read on how hard the app would be to rebuild with AI coding tools — rebuild difficulty, not a prediction that anyone will.',
            'Nothing about revenue is sent to the model. Difficulty is a property of what the app does, not of what it earns, and letting the figure into the prompt would produce verdicts that just track the money.',
          ],
        },
        {
          question: 'What are app insights, and who writes them?',
          answer: [
            'The founder does, from their dashboard: the value proposition, the problem the app solves, who it is for, and how it is marketed.',
            'They are the parts of a listing that only the person who built it can answer honestly, which is why they are not generated on their behalf.',
          ],
        },
        {
          question: 'Is there a page for me as a founder?',
          answer: [
            'Yes. Every founder gets a public profile listing the apps they have verified, linked from each app page.',
            'If you sign in with X, it carries your handle and avatar.',
          ],
        },
      ],
    },
    {
      heading: 'Upgrades and billing',
      items: [
        {
          question: 'What does the dofollow link buy?',
          answer: [
            `${formatMoney(dofollow.priceCents)}, once, turns the link from your listing to your own site into a dofollow one, so search engines and AI assistants treat your site as the canonical destination.`,
            'That is the whole of it. It is not a subscription, and we do not quote a domain authority figure because no SEO tool has measured this domain yet.',
          ],
        },
        {
          question: 'Does paying change my ranking or my badge?',
          answer: [
            'No, and it never will. The leaderboard is ordered by verified revenue, and the badge is earned by a live provider connection.',
            'An upgrade that could move either would make every number on the site worth less, including the ones people paid for.',
          ],
        },
        {
          question: 'Can I sponsor a placement on the site?',
          answer: [
            'The sponsor rails are not running at the moment. With nothing sold, two "advertise here" boxes in the margins of every page advertise mainly that nobody is buying.',
            `If you want a placement when they are switched on, reach me on X at @${site.x.handle}.`,
          ],
          link: { href: site.x.url, label: `@${site.x.handle} on X` },
        },
        {
          question: 'Where are my invoices?',
          answer: [
            'Purchases run through Polar, our merchant of record, and the billing tab in your account opens their portal.',
            'Invoices, receipts and card details all live there rather than here.',
          ],
          link: { href: '/account', label: 'Account and billing' },
        },
      ],
    },
    {
      heading: 'Marketplace',
      items: [
        {
          question: 'Can I buy or sell an app here?',
          answer: [
            'Not yet. The marketplace is announced rather than open, and the page says so plainly instead of showing an empty listings grid.',
            'When it opens, listings will draw on the revenue history already collected — so an app verified today will have months of it by then.',
          ],
          link: { href: '/marketplace', label: 'What the marketplace will be' },
        },
        {
          question: 'Will you broker the sale?',
          answer: [
            'No. The plan is verified revenue history and App Store metadata next to an asking price, with buyer and founder talking directly.',
            'We are not an escrow agent and we do not take a cut of a sale.',
          ],
        },
      ],
    },
    {
      heading: 'Account and contact',
      items: [
        {
          question: 'How do I sign in?',
          answer: [
            'With X or with Google. There is no password to forget, and no separate account to create.',
            'Signing in with X also fills in your founder profile.',
          ],
        },
        {
          question: 'Will you email me?',
          answer: [
            'Only about your own apps — a key that has stopped working, or something that needs your attention on a listing.',
            'There is no newsletter to be added to.',
          ],
        },
        {
          question: 'How do I get in touch?',
          answer: [
            `Reach me on X at @${site.x.handle}. Corrections to a figure or a listing are welcome, and read.`,
          ],
          link: { href: site.x.url, label: `@${site.x.handle} on X` },
        },
      ],
    },
  ]
}
