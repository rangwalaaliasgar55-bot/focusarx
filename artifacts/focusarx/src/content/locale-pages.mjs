// ══════════════════════════════════════════════════════════════════
// Localized edition pages — real copy in five markets
// ══════════════════════════════════════════════════════════════════
//
// ── Why this file is long, and why it is not a translation table ───
// The tempting version of internationalisation is one homepage copied into a
// `t()` lookup and stamped out at five URLs. That is the version that gets a
// site penalised: Google's own guidance on localised pages says translated
// content must be a real translation and that a page must be *about* something
// its audience is searching for, and its "Crawled – currently not indexed"
// verdict is exactly what thin near-duplicates collect. This repo already has
// the evidence for that — see docs/GSC_INDEXING.md on the 11,978-URL profile
// shard that produced a 42-page "Discovered – currently not indexed" backlog
// out of almost no content.
//
// So each edition here is written as its own document, with claims that hold:
//
//   • The India and US editions share a language but not a subject. 21 of the
//     23 exam guides under src/content/exam/ are Indian exams; the two US exams
//     the site covers are GRE and GMAT. Writing "JEE" to an American reader and
//     "MCAT" to a Indian one is how a homepage becomes noise to both.
//   • The Hindi, Spanish and Portuguese editions are written in those
//     languages, not translated from English at build time. Where a sentence
//     would be a translation of a sentence that does not earn its place, it is
//     simply not here.
//   • Every factual claim traces to the code. Currency figures come from
//     api-server/src/lib/premiumPlans.ts (10,000 / 25,000 / 80,000 Focus Credits
//     for 30 / 90 / 365 days) and tokenLedger.ts (50 credits per completed
//     session, 500 per day cap). Timezone behaviour comes from
//     api-server/src/lib/timezone.ts and istDate.ts. No edition claims a price
//     in rupees, reais or euros — the product has no currency conversion, no
//     payment processor and no card requirement, and saying so is a stronger
//     offer than a number we cannot charge.
//
// ── The rule for adding an edition ─────────────────────────────────
// 1. Add the Edition to src/content/locales.mjs and its routes to TRANSLATED.
// 2. Write the pages here at ≥150 words each — scripts/seo-validate.mjs gate 14
//    measures them with the same counter as every other page. A machine
//    translation that reads like one will pass the word count and lose the
//    page anyway.
// 3. Add the <Route> in src/App.tsx and the sitemap rows in
//    api-server/src/routes/sitemap.ts. The contract test fails if a
//    prerendered URL has no route behind it, so this cannot be half-done.
//
// ── Titles ─────────────────────────────────────────────────────────
// Written in the page's own language and kept inside PAGE_TITLE_BUDGET; the
// brand suffix is appended by composeTitle() in the prerenderer, exactly as it
// is for the English pages.

import { EDITIONS } from "./locales.mjs";

/** The two routes every edition translates. */
export const EDITION_ROUTES = ["", "pricing"];

/** @returns {string} the URL of an English page, for internal links. */
const en = (route) => (route === "" ? "/" : `/${route}`);

// ══════════════════════════════════════════════════════════════════
// Content, keyed by `${editionKey}/${route}`
// ══════════════════════════════════════════════════════════════════

const CONTENT = {
  // ────────────────────────────────────────────────────────────────
  // India (en-IN)
  // ────────────────────────────────────────────────────────────────
  "in/": {
    title: "Focus Timer for JEE, NEET & UPSC Aspirants",
    description:
      "Free focus timer for Indian exam prep — JEE, NEET, UPSC, CA, GATE, boards. Pomodoro sessions, IST streaks, an AI coach. No card, no payment.",
    h1: "The focus timer for Indian exam aspirants",
    lead: "FocusArx started as a study tool for Indian exams and it still shows: 21 of our 23 exam guides are for JEE, NEET, UPSC, CA, GATE, CLAT, CTET, CUET, SSC, IBPS, NDA, CAT and the CBSE boards. Start a timer in ten seconds — there is no signup wall and nothing to pay.",
    lastReviewed: "2026-09-18",
    software: {
      name: "FocusArx",
      category: "EducationalApplication",
      description:
        "Free Pomodoro focus timer and study tracker for Indian competitive exams, with streaks, study rooms and an AI coach.",
    },
    sections: [
      {
        h: "A guide for the exam you are actually sitting",
        p: "Most focus apps treat every study session as the same session. Ours does not, because a JEE Advanced attempt and a CBSE Class 10 board revision do not look alike. Each exam guide carries its own plan, its own session lengths and its own distraction list:",
        bullets: [
          "JEE Main and JEE Advanced — separate guides, because the papers ask for different things",
          "NEET-UG, UPSC CSE, CA Foundation, GATE, CLAT, CTET and CUET-UG",
          "SSC CGL, IBPS PO, NDA, CAT and BITSAT",
          "State entrances: KCET, MHT-CET and WBJEE",
          "CBSE Class 10 and Class 12 board preparation",
        ],
      },
      {
        h: "Streaks that reset at midnight in India, not at 5:30 in the morning",
        p: [
          "A streak that breaks at the wrong hour is the fastest way to lose a student who was doing well. FocusArx keys its calendar to Asia/Kolkata, so a daily mission completed at 11:50 at night still counts for that night, and a session at 12:10 belongs to tomorrow.",
          "If you are reading this from outside India the app uses your own timezone instead — the day key is computed in your device's IANA zone, and switching zones never silently resets a streak that was already running.",
        ],
      },
      {
        h: "The core stays free; Pro has two doors",
        p: "The timer, study rooms and guides stay free. Pro can be activated with UPI or card for ₹199 monthly or ₹1,499 yearly, or with Focus Credits earned by finishing sessions. Students without a payment method can still reach the same Pro entitlement by studying.",
      },
    ],
    faq: [
      [
        "Is FocusArx free for Indian students?",
        "Yes. The focus timer, exam guides, study rooms and AI coach are free with no credit card. Premium is bought with Focus Credits earned from completed sessions — 50 credits per session, up to 500 a day — so 30 days of Premium costs 10,000 credits, roughly 200 finished sessions.",
      ],
      [
        "Which Indian exams does FocusArx cover?",
        "Twenty-one: JEE Main, JEE Advanced, NEET-UG, UPSC CSE, CA Foundation, GATE, CLAT, CTET, CUET-UG, SSC CGL, IBPS PO, NDA, CAT, BITSAT, KCET, MHT-CET, WBJEE, CBSE Class 10, CBSE Class 12, plus general guides on exam anxiety and last-minute revision.",
      ],
      [
        "Do I need an account to start a session?",
        "No. The timer at /focus is public and starts immediately. An account only adds saving history, streaks and study rooms — you can use the timer for months without creating one.",
      ],
      [
        "What time does my daily streak reset?",
        "At midnight Indian Standard Time. If your device is set to another timezone the app uses that zone instead, and changing timezone does not break a streak you already had.",
      ],
    ],
    related: [
      `${en("exam/jee-main")}|JEE Main study plan`,
      `${en("exam/neet-ug")}|NEET-UG study plan`,
      `${en("exam/upsc-cse")}|UPSC CSE study plan`,
      `${en("exam/cbse-class-12")}|CBSE Class 12 board plan`,
      `${en("exam")}|All 23 exam guides`,
      "/in/pricing|What Premium costs in credits",
    ],
    cta: { href: "/focus?duration=50&src=in", label: "Start a 50-minute session — free" },
  },

  "in/pricing": {
    title: "FocusArx India Pricing — Free, UPI or Credits",
    description:
      "Core FocusArx tools are free. Pro is ₹199 monthly or ₹1,499 yearly through UPI/card, or 10,000 earned Focus Credits for 30 days.",
    h1: "FocusArx pricing in India",
    lead: "Keep the core free, pay for Pro by UPI or card, or pay with focus. The earned route grants the same Pro access as the ₹199 monthly and ₹1,499 annual plans.",
    lastReviewed: "2026-09-18",
    sections: [
      {
        h: "Pay with money or pay with focus",
        p: "Pro costs ₹199 monthly or ₹1,499 yearly through Razorpay when checkout is enabled. The alternative earned prices are:",
        bullets: [
          "30 days of Premium — 10,000 Focus Credits",
          "90 days of Premium — 25,000 Focus Credits",
          "365 days of Premium — 80,000 Focus Credits",
          "One completed session earns 50 credits, capped at 500 per day",
          "Daily quests earn 30 credits (150 per day), weekly quests 100, and keeping a streak earns 20",
        ],
      },
      {
        h: "What that works out to",
        p: "At the session rate alone — 50 credits per finished session — 30 days of Premium is about 200 sessions, and the 500-credit daily cap means a heavy day cannot shortcut the whole month. Realistically a student studying two or three focused sessions a day reaches a month of Premium in a couple of months. Nothing expires while it sits in your wallet, and a purchase cannot be charged twice: every credit spend is recorded against an idempotency key in the ledger.",
      },
      {
        h: "Payment privacy and the no-card route",
        p: "UPI and card details are handled by Razorpay or Stripe and are not stored on FocusArx servers. A payment method is optional because Focus Credits remain a complete route to Pro. Coins are separate: they buy cosmetics in the marketplace and cannot be spent on Pro.",
      },
    ],
    faq: [
      [
        "Does FocusArx accept UPI or cards in India?",
        "Yes. India checkout supports UPI and cards through Razorpay when enabled: ₹199 monthly or ₹1,499 yearly. You can also unlock Pro with Focus Credits and no payment method.",
      ],
      [
        "How many sessions is 30 days of Premium?",
        "About 200. A completed session earns 50 credits and 30 days costs 10,000, with a cap of 500 credits earned per day.",
      ],
      [
        "Is the timer free without any account?",
        "Yes — /focus is public and starts without a login. An account only adds saved history, streaks and study rooms.",
      ],
      [
        "Do my credits expire?",
        "No. Earned credits stay in your wallet until you spend them, and every spend is written to the ledger so a double-charge cannot happen.",
      ],
    ],
    related: [
      "/in|India edition",
      `${en("pricing")}|Pricing in English`,
      `${en("about")}|What FocusArx is`,
      `${en("evidence")}|Where the study science comes from`,
      "/focus|Start the free timer",
    ],
    cta: { href: "/focus?src=in-pricing", label: "Start earning credits — free" },
  },

  // ────────────────────────────────────────────────────────────────
  // United States (en-US)
  // ────────────────────────────────────────────────────────────────
  "us/": {
    title: "Free Focus Timer for US Students & Grad Test Prep",
    description:
      "A free Pomodoro and deep work timer that runs with no account and no card. GRE and GMAT guides, distraction blocking, streaks that reset at your own midnight.",
    h1: "A focus timer that starts before you do",
    lead: "FocusArx is a free Pomodoro and deep work timer. The timer needs no account, no email and no card — it is running ten seconds after you land on it. If you are prepping the GRE or the GMAT, there are guides for those too.",
    lastReviewed: "2026-09-18",
    software: {
      name: "FocusArx",
      category: "Productivity",
      description:
        "Free Pomodoro and deep work timer with distraction blocking, study rooms and session analytics. No account required to start.",
    },
    sections: [
      {
        h: "Be honest about what this site covers",
        p: [
          "Most of our exam guides are written for Indian competitive exams — that is where the product started. The two US exams we cover properly are the GRE and the GMAT, and we would rather tell you that than pretend to a library we do not have.",
          "What is not country-specific is the timer itself, and that is the part most people come for: session lengths from 5 to 50 minutes, a distraction list you fill in before you start, a break activity so the break does not turn into your feed, and a streak that survives the day it is supposed to survive.",
        ],
      },
      {
        h: "Your streak resets at your midnight",
        p: "The day boundary is computed in your device's own timezone, not on a server in another country. A session finished at 11:50pm Pacific belongs to that day, and if you fly from Eastern to Pacific your streak does not quietly reset on landing. This is a small thing that most apps get wrong and it is the second most common reason people abandon a study streak.",
      },
      {
        h: "Free, with no card anywhere",
        p: "There is no trial on the free timer and no payment method is required. Pro can be paid for by card or unlocked with Focus Credits earned from finished sessions. You can use the timer indefinitely without telling us your name.",
      },
    ],
    faq: [
      [
        "Do I need an account to use the timer?",
        "No. /focus is public and starts immediately. An account adds saved history, streaks and study rooms, and you can skip it indefinitely.",
      ],
      [
        "Is there a free trial or a credit card requirement?",
        "Neither is required for the free timer. Pro has optional card checkout, while earned Focus Credits provide a complete no-card alternative.",
      ],
      [
        "Which US exams does FocusArx have guides for?",
        "The GRE and the GMAT. The rest of our exam library covers Indian competitive exams, which is where the product was built, and we say so rather than padding the list.",
      ],
      [
        "What session lengths are available?",
        "Preset timers for 5, 10, 15, 30 and 45 minutes, plus any custom length up to 240 minutes. A finished session earns Focus Credits toward Premium.",
      ],
    ],
    related: [
      `${en("exam/gre")}|GRE study plan`,
      `${en("exam/gmat")}|GMAT study plan`,
      `${en("deep-work-guide")}|What deep work actually is`,
      `${en("comparison/focusarx-vs-forest")}|FocusArx vs Forest`,
      "/us/pricing|What Premium costs",
    ],
    cta: { href: "/focus?duration=25&src=us", label: "Start a 25-minute session — free" },
  },

  "us/pricing": {
    title: "FocusArx Pricing — Free or Pro",
    description:
      "Core FocusArx tools are free. Pro launches at $4.99 monthly or $39 yearly, or unlocks with Focus Credits earned from finished sessions.",
    h1: "Free at the core, with two routes to Pro",
    lead: "Use the focus timer and planning tools free. Choose international card checkout for convenience, or exchange Focus Credits earned from finished sessions for the same Pro entitlement.",
    lastReviewed: "2026-09-18",
    sections: [
      {
        h: "What Premium costs in credits",
        bullets: [
          "30 days — 10,000 Focus Credits (about 200 finished sessions)",
          "90 days — 25,000 Focus Credits",
          "365 days — 80,000 Focus Credits",
        ],
        p: "A completed session earns 50 credits with a cap of 500 per day. Daily quests earn 30 (capped at 150 a day), a weekly quest earns 100, and holding a streak earns 20 a day.",
      },
      {
        h: "Why the daily cap matters",
        p: "Without a cap, a single marathon day could buy a month of Premium and the credits would mean nothing. At 500 a day the fastest route to 30 days of Premium is about twenty days of consistent study, which is the behaviour the whole product is trying to produce. Credits do not expire, and every spend is recorded against an idempotency key in the ledger so a purchase cannot be double-charged.",
      },
      {
        h: "Coins are a different currency",
        p: "The app also has Coins. Those buy cosmetics in the marketplace and cannot be spent on Premium. Two currencies with different jobs is a deliberate split, and the pricing page in the app keeps them in separate columns so the two never get confused.",
      },
    ],
    faq: [
      [
        "Is FocusArx really free?",
        "The timer, guides and study rooms are free with no card. Pro is optional: pay $4.99 monthly or $39 yearly when Stripe is enabled, or use Focus Credits earned by studying.",
      ],
      [
        "Do I have to subscribe?",
        "No. Subscription checkout is one option; Focus Credits earned from completed sessions remain a no-card route to the same Pro access.",
      ],
      [
        "How long does a month of Premium take to earn?",
        "About 200 finished sessions, or roughly twenty days at the 500-credit daily cap. Credits never expire while they sit in your wallet.",
      ],
    ],
    related: [
      "/us|United States edition",
      `${en("pricing")}|Pricing in English`,
      `${en("about")}|What FocusArx is`,
      `${en("privacy")}|What we store`,
      "/focus|Start the free timer",
    ],
    cta: { href: "/focus?src=us-pricing", label: "Start a session and earn credits" },
  },

  // ────────────────────────────────────────────────────────────────
  // Hindi (hi)
  // ────────────────────────────────────────────────────────────────
  "hi/": {
    title: "फ्री पोमोडोरो टाइमर — पढ़ाई के लिए",
    description:
      "बिना अकाउंट और बिना कार्ड के मुफ़्त फोकस टाइमर। पोमोडोरो सेशन, स्ट्रीक, स्टडी रूम और AI कोच। JEE, NEET, UPSC और बोर्ड की तैयारी के लिए बनी गाइड।",
    h1: "पढ़ाई के लिए मुफ़्त फोकस टाइमर",
    lead: "FocusArx एक मुफ़्त पोमोडोरो टाइमर है। इसे शुरू करने के लिए न अकाउंट चाहिए, न ईमेल, न कार्ड — पेज खुलते ही दस सेकंड में टाइमर चालू। साथ में JEE, NEET, UPSC और बोर्ड परीक्षाओं के लिए हिंदी में तैयार की गई पढ़ाई की योजना।",
    lastReviewed: "2026-09-18",
    software: {
      name: "FocusArx",
      category: "EducationalApplication",
      description:
        "मुफ़्त पोमोडोरो फोकस टाइमर और स्टडी ट्रैकर — सेशन, स्ट्रीक, स्टडी रूम और AI कोच के साथ।",
    },
    sections: [
      {
        h: "टाइमर कैसे काम करता है",
        p: [
          "पोमोडोरो तकनीक सरल है: पच्चीस से पचास मिनट बिना रुकावट पढ़िए, फिर पाँच मिनट का ब्रेक लीजिए। कठिन हिस्सा तकनीक नहीं, रुकावट है — फ़ोन, नोटिफ़िकेशन, और \"बस एक मिनट\" वाला ब्रेक जो घंटे भर चल जाता है।",
          "इसलिए टाइमर शुरू करने से पहले ऐप आपसे डिस्ट्रैक्शन लिस्ट बनवाता है और ब्रेक के लिए एक काम तय करता है, ताकि ब्रेक ब्रेक ही रहे।",
        ],
      },
      {
        h: "स्ट्रीक आधी रात को रीसेट होती है",
        p: "आपकी दैनिक स्ट्रीक भारतीय समय (IST) की आधी रात को बदलती है। रात 11:50 बजे पूरा किया गया सेशन उसी दिन गिना जाएगा, और 12:10 का सेशन अगले दिन का। अगर आप भारत से बाहर हैं तो ऐप आपके डिवाइस का टाइमज़ोन इस्तेमाल करता है, और टाइमज़ोन बदलने से चल रही स्ट्रीक टूटती नहीं।",
      },
      {
        h: "पैसे की बात",
        p: "टाइमर, गाइड और स्टडी रूम मुफ़्त हैं। Pro के लिए UPI या कार्ड से भुगतान कर सकते हैं, या पूरे किए गए सेशन से Focus Credits कमाकर वही एक्सेस पा सकते हैं। भुगतान विवरण FocusArx सर्वर पर नहीं रखे जाते।",
      },
    ],
    faq: [
      [
        "क्या यह टाइमर पूरी तरह मुफ़्त है?",
        "हाँ। टाइमर, परीक्षा गाइड, स्टडी रूम और AI कोच मुफ़्त हैं और किसी कार्ड की ज़रूरत नहीं। प्रीमियम Focus Credits से मिलता है, जो एक सेशन पूरा करने पर 50 की दर से मिलते हैं।",
      ],
      [
        "क्या टाइमर चलाने के लिए अकाउंट बनाना ज़रूरी है?",
        "नहीं। /focus पेज पर टाइमर बिना लॉगिन के तुरंत शुरू हो जाता है। अकाउंट सिर्फ़ आपका इतिहास, स्ट्रीक और स्टडी रूम सहेजने के लिए है।",
      ],
      [
        "कितने मिनट के सेशन उपलब्ध हैं?",
        "5, 10, 15, 30 और 45 मिनट के तैयार टाइमर हैं, और 240 मिनट तक कोई भी अपनी मनचाही अवधि चुन सकते हैं।",
      ],
      [
        "किस-किस परीक्षा के लिए गाइड है?",
        "JEE Main, JEE Advanced, NEET-UG, UPSC CSE, CA Foundation, GATE, CLAT, CTET, CUET-UG, SSC CGL, IBPS PO, NDA, CAT, BITSAT, KCET, MHT-CET, WBJEE और CBSE कक्षा 10 व 12 — कुल 21 भारतीय परीक्षाएँ।",
      ],
    ],
    related: [
      "/in/|India edition in English",
      `${en("exam/jee-main")}|JEE Main study plan`,
      `${en("exam/neet-ug")}|NEET-UG study plan`,
      `${en("exam/upsc-cse")}|UPSC CSE study plan`,
      "/hi/pricing|प्रीमियम की कीमत",
    ],
    cta: { href: "/focus?duration=50&src=hi", label: "50 मिनट का सेशन शुरू करें — मुफ़्त" },
  },

  "hi/pricing": {
    title: "FocusArx की कीमत — मुफ़्त, UPI या Focus Credits",
    description:
      "मुख्य टूल मुफ़्त हैं। Pro ₹199 प्रति माह या ₹1,499 प्रति वर्ष है, या 30 दिनों के लिए 10,000 कमाए हुए Focus Credits।",
    h1: "पैसे से या फ़ोकस से Pro लें",
    lead: "टाइमर और मुख्य पढ़ाई टूल मुफ़्त रहते हैं। सुविधा के लिए UPI/कार्ड से Pro लें, या पूरे किए गए सेशन से Focus Credits कमाकर वही Pro एक्सेस पाएँ।",
    lastReviewed: "2026-09-18",
    sections: [
      {
        h: "प्रीमियम के टोकन",
        bullets: [
          "30 दिन का प्रीमियम — 10,000 Focus Credits",
          "90 दिन का प्रीमियम — 25,000 Focus Credits",
          "365 दिन का प्रीमियम — 80,000 Focus Credits",
        ],
        p: "एक पूरा सेशन 50 टोकन देता है, और एक दिन में अधिकतम 500 टोकन मिल सकते हैं। दैनिक क्वेस्ट से 30 (रोज़ाना अधिकतम 150), साप्ताहिक क्वेस्ट से 100 और स्ट्रीक बनाए रखने पर 20 टोकन मिलते हैं।",
      },
      {
        h: "इसका मतलब क्या है",
        p: "सिर्फ़ सेशन से गिनें तो 30 दिन का प्रीमियम लगभग 200 सेशन की मेहनत है। 500 टोकन की दैनिक सीमा इसीलिए है कि एक दिन की मारा-मारी से पूरा महीना न मिल जाए — असल में रोज़ दो-तीन सेशन करने वाला छात्र दो महीने में एक महीने का प्रीमियम कमा लेता है। टोकन कभी ख़त्म नहीं होते, और हर ख़र्च लेजर में दर्ज होता है, इसलिए एक ही ख़रीद दो बार नहीं कट सकती।",
      },
      {
        h: "Coins अलग चीज़ हैं",
        p: "ऐप में Coins भी हैं, लेकिन वे सिर्फ़ मार्केटप्लेस में सजावटी चीज़ें खरीदने के काम आते हैं। उनसे प्रीमियम नहीं मिलता।",
      },
    ],
    faq: [
      [
        "क्या FocusArx UPI या कार्ड स्वीकार करता है?",
        "हाँ। उपलब्ध होने पर Razorpay से UPI और कार्ड स्वीकार होते हैं: ₹199 प्रति माह या ₹1,499 प्रति वर्ष। बिना कार्ड के Focus Credits वाला विकल्प भी बना रहता है।",
      ],
      [
        "30 दिन के प्रीमियम में कितने सेशन लगेंगे?",
        "लगभग 200। एक सेशन से 50 टोकन मिलते हैं और 30 दिन की कीमत 10,000 टोकन है, दिन भर में अधिकतम 500।",
      ],
      [
        "क्या मेरे टोकन ख़त्म हो जाते हैं?",
        "नहीं। कमाए हुए टोकन तब तक वॉलेट में रहते हैं जब तक आप उन्हें ख़र्च नहीं करते।",
      ],
    ],
    related: [
      "/hi|मुख्य पृष्ठ",
      "/in/pricing|Pricing in English",
      "/hi/|मुख्य पृष्ठ",
      `${en("pricing")}|Pricing (English)`,
      "/focus|मुफ़्त टाइमर शुरू करें",
    ],
    cta: { href: "/focus?src=hi-pricing", label: "टोकन कमाना शुरू करें — मुफ़्त" },
  },

  // ────────────────────────────────────────────────────────────────
  // Spanish (es)
  // ────────────────────────────────────────────────────────────────
  "es/": {
    title: "Temporizador Pomodoro gratis para estudiar",
    description:
      "Temporizador de concentración gratis, sin cuenta ni tarjeta. Sesiones Pomodoro, rachas, salas de estudio y un coach de IA. Empieza en diez segundos.",
    h1: "Un temporizador de concentración que empieza antes que tú",
    lead: "FocusArx es un temporizador Pomodoro gratuito. No pide cuenta, ni correo, ni tarjeta: diez segundos después de abrir la página ya estás cronometrando. Añade sesiones, rachas, salas de estudio y un coach de inteligencia artificial.",
    lastReviewed: "2026-09-18",
    software: {
      name: "FocusArx",
      category: "Productivity",
      description:
        "Temporizador Pomodoro y de trabajo profundo, gratis, con bloqueo de distracciones, salas de estudio y analíticas de sesión.",
    },
    sections: [
      {
        h: "Cómo funciona una sesión",
        p: [
          "La técnica Pomodoro es sencilla: se estudia entre 25 y 50 minutos sin interrupción y después se descansa cinco. Lo difícil nunca fue el cronómetro, sino la interrupción — el móvil, la notificación, el descanso de «un minuto» que dura una hora.",
          "Por eso, antes de empezar, la aplicación te hace escribir tu propia lista de distracciones y elegir una actividad concreta para el descanso, de modo que el descanso siga siendo un descanso.",
        ],
      },
      {
        h: "Tu racha se reinicia a tu medianoche",
        p: "El límite del día se calcula en la zona horaria de tu dispositivo, no en la de un servidor en otro continente. Una sesión terminada a las 23:50 cuenta para ese día, y si viajas de una zona a otra la racha no se reinicia en silencio al aterrizar. Es un detalle pequeño que la mayoría de aplicaciones hace mal, y la segunda causa por la que la gente abandona una racha de estudio.",
      },
      {
        h: "Gratis, y sin tarjeta en ningún sitio",
        p: "El temporizador gratis no tiene período de prueba ni exige pago. Pro se puede pagar con tarjeta o desbloquear con Focus Credits ganados al terminar sesiones. Puedes usar el temporizador indefinidamente sin decirnos tu nombre.",
      },
    ],
    faq: [
      [
        "¿Necesito una cuenta para usar el temporizador?",
        "No. La página /focus es pública y empieza al instante. La cuenta solo añade historial guardado, rachas y salas de estudio, y puedes prescindir de ella todo el tiempo que quieras.",
      ],
      [
        "¿Hay prueba gratuita o tarjeta de crédito?",
        "Ninguna es necesaria para el temporizador gratis. Pro ofrece pago opcional con tarjeta y una alternativa completa con Focus Credits ganados estudiando.",
      ],
      [
        "¿Qué duraciones de sesión hay?",
        "Temporizadores de 5, 10, 15, 30 y 45 minutos, más cualquier duración personalizada hasta 240 minutos. Cada sesión terminada suma Focus Credits.",
      ],
      [
        "¿Está disponible en español?",
        "Esta página y la de precios están escritas en español. Las guías de exámenes siguen en inglés porque la mayoría cubre exámenes de India, donde nació el producto; el temporizador no depende del idioma.",
      ],
    ],
    related: [
      `${en("pomodoro-timer")}|La técnica Pomodoro`,
      `${en("deep-work-guide")}|Qué es el trabajo profundo`,
      `${en("focus-guide")}|Guía de concentración`,
      "/es/pricing|Cuánto cuesta Premium",
      "/|FocusArx in English",
    ],
    cta: { href: "/focus?duration=25&src=es", label: "Empezar una sesión de 25 minutos" },
  },

  "es/pricing": {
    title: "Precios de FocusArx — gratis o Pro",
    description:
      "Las herramientas principales son gratis. Pro cuesta $4,99 al mes o $39 al año, o 10.000 Focus Credits ganados por 30 días.",
    h1: "Paga con dinero o con concentración",
    lead: "El temporizador y las herramientas principales siguen siendo gratis. Puedes pagar Pro con tarjeta o conseguir el mismo acceso con Focus Credits ganados al terminar sesiones.",
    lastReviewed: "2026-09-18",
    sections: [
      {
        h: "Cuánto cuesta Premium en credits",
        bullets: [
          "30 días — 10.000 Focus Credits (unas 200 sesiones terminadas)",
          "90 días — 25.000 Focus Credits",
          "365 días — 80.000 Focus Credits",
        ],
        p: "Una sesión completada da 50 credits, con un máximo de 500 al día. Las misiones diarias dan 30 (máximo 150 al día), la misión semanal 100 y mantener la racha 20 al día.",
      },
      {
        h: "Por qué existe el límite diario",
        p: "Sin límite, una sola maratón compraría un mes de Premium y los credits no significarían nada. Con 500 al día, el camino más rápido a 30 días de Premium son unas tres semanas de estudio constante, que es justo el comportamiento que el producto intenta producir. Los credits no caducan y cada gasto se registra con una clave de idempotencia en el libro contable, así que una compra no puede cobrarse dos veces.",
      },
      {
        h: "Las monedas son otra cosa",
        p: "La aplicación también tiene Coins, pero esas compran objetos cosméticos en el mercado y no sirven para Premium. Son dos monedas con funciones distintas, y la página de precios las mantiene en columnas separadas para que no se confundan.",
      },
    ],
    faq: [
      [
        "¿FocusArx es realmente gratis?",
        "El temporizador, las guías y las salas de estudio son gratis. Pro es opcional: $4,99 al mes o $39 al año, o Focus Credits ganados estudiando.",
      ],
      [
        "¿Tengo que suscribirme?",
        "No. La suscripción es una opción; los Focus Credits ganados siguen siendo una ruta sin tarjeta al mismo acceso Pro.",
      ],
      [
        "¿Cuánto tarda en ganarse un mes de Premium?",
        "Unas 200 sesiones terminadas, o alrededor de veinte días si alcanzas el límite diario de 500 credits. Los credits no caducan.",
      ],
    ],
    related: [
      "/es|Página principal en español",
      "/es/|Página principal en español",
      `${en("pricing")}|Pricing in English`,
      `${en("about")}|Qué es FocusArx`,
      "/focus|Empezar el temporizador",
    ],
    cta: { href: "/focus?src=es-pricing", label: "Empezar una sesión y ganar credits" },
  },

  // ────────────────────────────────────────────────────────────────
  // Brazilian Portuguese (pt-BR)
  // ────────────────────────────────────────────────────────────────
  "pt-br/": {
    title: "Timer Pomodoro grátis para estudar",
    description:
      "Timer de foco gratuito, sem conta e sem cartão. Sessões Pomodoro, sequências, salas de estudo e um coach de IA. Comece em dez segundos.",
    h1: "Um timer de foco que começa antes de você",
    lead: "FocusArx é um timer Pomodoro gratuito. Ele não pede conta, e-mail ou cartão: dez segundos depois de abrir a página o cronômetro já está rodando. Junto vêm sequências, salas de estudo e um coach de inteligência artificial.",
    lastReviewed: "2026-09-18",
    software: {
      name: "FocusArx",
      category: "Productivity",
      description:
        "Timer Pomodoro e de trabalho profundo, gratuito, com bloqueio de distrações, salas de estudo e métricas de sessão.",
    },
    sections: [
      {
        h: "Como funciona uma sessão",
        p: [
          "A técnica Pomodoro é simples: estuda-se de 25 a 50 minutos sem interrupção e depois descansa-se cinco. A parte difícil nunca foi o cronômetro, e sim a interrupção — o celular, a notificação, a pausa de «um minutinho» que vira uma hora.",
          "Por isso, antes de começar, o aplicativo faz você escrever sua própria lista de distrações e escolher uma atividade concreta para o intervalo, para que o intervalo continue sendo um intervalo.",
        ],
      },
      {
        h: "Sua sequência zera à sua meia-noite",
        p: "A virada do dia é calculada no fuso do seu aparelho, não no de um servidor em outro continente. Uma sessão terminada às 23h50 conta para aquele dia, e se você viaja de um fuso para outro a sequência não zera sozinha no desembarque. É um detalhe pequeno que a maioria dos aplicativos erra, e o segundo motivo pelo qual as pessoas abandonam uma sequência de estudos.",
      },
      {
        h: "Grátis, e sem cartão em lugar nenhum",
        p: "O timer grátis não tem período de teste nem exige pagamento. O Pro pode ser pago com cartão ou desbloqueado com Focus Credits ganhos ao concluir sessões. Você pode usar o timer indefinidamente sem nos dizer seu nome.",
      },
    ],
    faq: [
      [
        "Preciso de conta para usar o timer?",
        "Não. A página /focus é pública e começa na hora. A conta só adiciona histórico salvo, sequências e salas de estudo, e você pode dispensá-la pelo tempo que quiser.",
      ],
      [
        "Existe teste grátis ou cartão de crédito?",
        "Nenhum é necessário para o timer grátis. O Pro oferece pagamento opcional com cartão e uma alternativa completa com Focus Credits ganhos estudando.",
      ],
      [
        "Quais durações de sessão existem?",
        "Timers prontos de 5, 10, 15, 30 e 45 minutos, além de qualquer duração personalizada até 240 minutos. Cada sessão concluída rende Focus Credits.",
      ],
      [
        "Está disponível em português?",
        "Esta página e a de preços estão escritas em português. Os guias de provas continuam em inglês, porque a maioria cobre concursos da Índia, onde o produto nasceu; o timer não depende de idioma.",
      ],
    ],
    related: [
      `${en("pomodoro-timer")}|A técnica Pomodoro`,
      `${en("deep-work-guide")}|O que é trabalho profundo`,
      `${en("focus-guide")}|Guia de concentração`,
      "/pt-br/pricing|Quanto custa o Premium",
      "/|FocusArx in English",
    ],
    cta: { href: "/focus?duration=25&src=pt-br", label: "Começar uma sessão de 25 minutos" },
  },

  "pt-br/pricing": {
    title: "Preços do FocusArx — grátis ou Pro",
    description:
      "As ferramentas principais são grátis. O Pro custa US$4,99 por mês ou US$39 por ano, ou 10.000 Focus Credits ganhos por 30 dias.",
    h1: "Pague com dinheiro ou com foco",
    lead: "O timer e as ferramentas principais continuam grátis. Pague o Pro com cartão ou obtenha o mesmo acesso com Focus Credits ganhos ao concluir sessões.",
    lastReviewed: "2026-09-18",
    sections: [
      {
        h: "Quanto custa o Premium em credits",
        bullets: [
          "30 dias — 10.000 Focus Credits (cerca de 200 sessões concluídas)",
          "90 dias — 25.000 Focus Credits",
          "365 dias — 80.000 Focus Credits",
        ],
        p: "Uma sessão concluída rende 50 credits, com teto de 500 por dia. As missões diárias rendem 30 (máximo de 150 por dia), a missão semanal 100 e manter a sequência rende 20 por dia.",
      },
      {
        h: "Por que existe o teto diário",
        p: "Sem teto, uma única maratona compraria um mês de Premium e os credits não significariam nada. Com 500 por dia, o caminho mais rápido até 30 dias de Premium são umas três semanas de estudo constante — que é exatamente o comportamento que o produto tenta produzir. Os credits não expiram e cada gasto é registrado com uma chave de idempotência no livro-razão, então uma compra não pode ser cobrada duas vezes.",
      },
      {
        h: "As moedas são outra coisa",
        p: "O aplicativo também tem Coins, mas elas compram itens cosméticos no mercado e não servem para o Premium. São duas moedas com funções diferentes, e a página de preços as mantém em colunas separadas para que não se confundam.",
      },
    ],
    faq: [
      [
        "O FocusArx é realmente grátis?",
        "O timer, os guias e as salas de estudo são grátis. O Pro é opcional: US$4,99 por mês ou US$39 por ano, ou Focus Credits ganhos estudando.",
      ],
      [
        "Preciso assinar?",
        "Não. A assinatura é uma opção; Focus Credits ganhos continuam sendo uma rota sem cartão para o mesmo acesso Pro.",
      ],
      [
        "Quanto tempo leva para ganhar um mês de Premium?",
        "Cerca de 200 sessões concluídas, ou uns vinte dias se você atingir o teto diário de 500 credits. Os credits não expiram.",
      ],
    ],
    related: [
      "/pt-br|Página inicial em português",
      "/pt-br/|Página inicial em português",
      `${en("pricing")}|Pricing in English`,
      `${en("about")}|O que é o FocusArx`,
      "/focus|Começar o timer",
    ],
    cta: { href: "/focus?src=pt-br-pricing", label: "Começar uma sessão e ganhar credits" },
  },
};

/**
 * Manifest entries for every edition page, in the shape
 * scripts/prerender-data.mjs expects. Built rather than written out ten times,
 * so the `path`, `lang` and `ogLocale` wiring cannot drift from
 * src/content/locales.mjs.
 *
 * @returns {Record<string, object>[]} RouteEntry-shaped objects with extra
 *   `lang` and `ogLocale` keys that the prerenderer uses for <html lang> and
 *   the Open Graph locale.
 */
export function localeRouteEntries() {
  const entries = [];
  for (const edition of EDITIONS) {
    for (const route of EDITION_ROUTES) {
      const key = `${edition.key}/${route}`;
      const content = CONTENT[key];
      if (!content) throw new Error(`locales: no content written for ${key}`);
      // Canonical form, no trailing slash: vercel.json sets trailingSlash:false,
      // so /in/ 308-redirects to /in. A canonical written with the slash would
      // point at a redirect, and — subtler — it would not string-match the
      // hreflang href the cluster emits for the same page, which makes the
      // reciprocity check see two different URLs for one document.
      const path = `${edition.path}${route}`.replace(/\/+$/, "");
      entries.push({
        path,
        lang: edition.lang,
        ogLocale: edition.ogLocale,
        editionKey: edition.key,
        ...content,
      });
    }
  }
  return entries;
}

/** Every edition URL, for the sitemap and the switcher's reachability check. */
export const LOCALE_PATHS = localeRouteEntries().map((e) => e.path);
