import { Html, Head, Main, NextScript } from "next/document";

const URL = "https://syncwatch-production-bf3c.up.railway.app";
const TITLE = "SyncWatch — Watch YouTube Together";
const DESC = "Watch YouTube videos in perfect sync with friends. Real-time play, pause, and seek. No account sharing needed.";
const OG_IMAGE = `${URL}/og-image.svg`;

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        {/* Core */}
        <meta charSet="utf-8" />
        <meta name="description" content={DESC} />
        <meta name="theme-color" content="#0D0D0D" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />

        {/* ── Open Graph (Facebook, LinkedIn, WhatsApp, Discord) ── */}
        <meta property="og:type" content="website" />
        <meta property="og:url" content={URL} />
        <meta property="og:site_name" content="SyncWatch" />
        <meta property="og:title" content={TITLE} />
        <meta property="og:description" content={DESC} />
        <meta property="og:image" content={OG_IMAGE} />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:image:alt" content="SyncWatch — Watch YouTube Together" />

        {/* ── Twitter Card ── */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:site" content="@syncwatch" />
        <meta name="twitter:title" content={TITLE} />
        <meta name="twitter:description" content={DESC} />
        <meta name="twitter:image" content={OG_IMAGE} />
        <meta name="twitter:image:alt" content="SyncWatch — Watch YouTube Together" />

        {/* Fonts */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;1,9..40,300&display=swap" rel="stylesheet" />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
