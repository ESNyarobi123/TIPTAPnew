export type LangCode = 'en' | 'sw';

export function normalizeLang(code: string | undefined): LangCode {
  const c = (code ?? 'en').toLowerCase();
  if (c === 'sw' || c === 'kiswahili') {
    return 'sw';
  }
  return 'en';
}

const STRINGS = {
  en: {
    welcome: (biz: string, host?: string | null) =>
      host
        ? `Welcome to *${biz}* — ${host} is your host today.`
        : `Welcome to *${biz}*.`,
    mainFood: 'How can we help you today?',
    mainBeauty: 'Relax — you’re in good hands. What would you like to do?',
    optFood: {
      '1': 'View menu',
      '2': 'Request bill',
      '3': 'Call waiter',
      '4': 'Customer support',
      '5': 'Change language',
      '6': 'Exit',
      '7': 'Rate your visit',
    },
    optBeauty: {
      '1': 'View services',
      '2': 'Request assistance / reception',
      '3': 'Customer support',
      '4': 'Change language',
      '5': 'Exit',
      '6': 'Rate your visit',
    },
    atRoot: 'You are already at the main menu.',
    back: 'Back.',
    exitThanks: 'Thank you — goodbye!',
    languageMenu: 'Choose language / Chagua lugha:\n1 — English\n2 — Kiswahili',
    languageSet: (l: string) => `Language set to ${l}.`,
    stub: 'Thanks — we have received your request.',
    menuSoon: 'Menu details will appear here once your business catalog is configured.',
    foodNoCategories: 'No menu categories are available yet.',
    foodNoItems: 'No items in this category.',
    foodCategoriesTitle: 'Menu categories',
    foodItemsTitle: 'Items',
    foodUnavailable: 'unavailable',
    foodWaiterOk: 'A waiter has been notified and will come to your table shortly.',
    foodBillOk: 'We are preparing your bill. Thank you.',
    foodSupportOk: 'Your support request has been logged. A team member will assist you.',
    foodNeedBranch:
      'This action needs a branch or table context. Your QR code did not include a branch. Please scan a **table QR** or a **branch business QR** (not the generic business QR without a location), or ask a staff member for help.',
    beautyNoCategories: 'No service categories are available yet.',
    beautyNoServices: 'No services in this category.',
    beautyCategoriesTitle: 'Service categories',
    beautyServicesTitle: 'Services',
    beautyUnavailable: 'unavailable',
    beautyAssistanceOk: 'We have notified reception — someone will assist you shortly.',
    beautySupportOk: 'Your message has been logged. Our team will follow up.',
    beautyNeedBranch:
      'This action needs a branch or station context. Please scan a **station QR** or a **branch business QR** that includes a location, or ask staff for help.',
    servicesSoon: 'Service list will appear here once your catalog is configured.',
    entryOpenFood: (biz: string, host?: string | null) =>
      `${host ? `Welcome to *${biz}* — ${host} is your host.\n\n` : `Welcome to *${biz}*.\n\n`}Reply **1** to see the menu and options.`,
    entryOpenBeauty: (biz: string, host?: string | null) =>
      `${host ? `Welcome to *${biz}* — ${host} is here to help.\n\n` : `Welcome to *${biz}*.\n\n`}Reply **1** to see services and options.`,
    ratingTargetTitle: 'What would you like to rate?',
    ratingOptBusiness: 'The restaurant / business',
    ratingOptStaff: 'Your server',
    ratingOptProvider: 'Your provider',
    ratingOptStaffAlt: 'Staff member',
    ratingOptService: 'A specific service or item',
    ratingNoStaff: 'No staff member is linked to this session — choose another option.',
    ratingScorePrompt: (min: number, max: number) => `Rate from ${min} to ${max} (or 0 to go back).`,
    ratingCommentPrompt: 'Add a short comment (or 0 to skip).',
    ratingCommentRequired: 'A comment is required. Please type your feedback.',
    ratingThanks: 'Thank you — your rating has been saved.',
    ratingDuplicate: 'You already submitted this rating. Thank you!',
    optSwitchToBeauty: 'Salon & beauty (switch)',
    optSwitchToFood: 'Restaurant & dining (switch)',
    optTipStaff: 'Tip staff (mobile money)',
    optPayWithMobile: 'Pay bill (mobile money / USSD)',
    foodTipNeedStaffQr:
      'To send a tip, scan a **staff or host QR** so we know who you are tipping. Then open Tip again.',
    foodTipAmountPrompt:
      'Enter tip amount in **whole shillings** (numbers only), e.g. 5000.\n0 — Main menu',
    foodTipAmountInvalid: 'Please enter a valid amount (whole shillings). 0 — Main menu',
    foodTipPhonePrompt: 'Enter the **mobile number** to receive the payment prompt (e.g. 07… or 255…).\n0 — Main menu',
    foodTipPhoneInvalid: 'Could not read that number. Try 07… or 255…. 0 — Main menu',
    foodTipUssdSent: 'Tip request sent. Approve the payment on your phone when prompted.',
    foodPayNoOrder: 'No open bill yet — add items from the menu first (option 1), then try Pay.',
    foodPayPhonePrompt: (orderNo: string, total: string) =>
      `Pay **${orderNo}** — total **${total}**.\nEnter mobile for USSD push (07… or 255…).\n0 — Main menu`,
    foodPayUssdSent: 'Payment prompt sent. Complete on your phone.',
    foodPayStillPending: 'Payment still pending — approve on your phone or wait a moment.',
    foodPayCompleted: 'Payment received. Thank you!',
    foodPayFailed: 'That payment did not complete. You can try Pay again from the menu.',
    payStatusHint: 'Reply **P** to refresh payment status.',
    optTipProvider: 'Tip your stylist (mobile money)',
    optPayVisitUssd: 'Pay for your visit (USSD / mobile money)',
    beautyTipNeedStaffQr:
      'To leave a gratuity, scan a **stylist or host QR** so we know who you’re thanking — then choose Tip again.',
    beautyTipAmountPrompt:
      'How much would you like to tip? Enter **whole shillings** only (e.g. 10000).\n0 — Main menu',
    beautyTipAmountInvalid: 'Use a whole-shilling amount (numbers only). 0 — Main menu',
    beautyTipPhonePrompt:
      '**Almost there.** Enter the mobile number for the USSD prompt (07… or 255…).\n0 — Main menu',
    beautyTipPhoneInvalid: 'We couldn’t read that — try 07… or 255…. 0 — Main menu',
    beautyTipUssdSent:
      'Check your phone — approve the prompt to finish your tip. Thank you for appreciating the team ✨',
    beautyPayNoBooking:
      'No charges on your visit yet. Add services with **1**, then tap **Pay for your visit**.',
    beautyPayPhonePrompt: (ref: string, total: string) =>
      `**${ref}** · total **${total}**\nMobile number for USSD (07… or 255…).\n0 — Main menu`,
    beautyPayUssdSent: 'Payment prompt sent — complete it on your phone when you’re ready.',
    beautyPayStillPending: 'Still processing — check your phone. Reply **P** in a moment to refresh.',
    beautyPayCompleted: 'All set — payment received. Thank you for choosing us!',
    beautyPayFailed: 'That payment didn’t go through. Try **Pay for your visit** again anytime.',
  },
  sw: {
    welcome: (biz: string, host?: string | null) =>
      host
        ? `Karibu *${biz}* — ${host} atakuhudumia leo.`
        : `Karibu *${biz}*.`,
    mainFood: 'Tunaweza kukusaidia vipi leo?',
    mainBeauty: 'Karibu salonini — tuko hapa kwa ajili yako. Ungependa nini?',
    optFood: {
      '1': 'Tazama menyu',
      '2': 'Omba bili',
      '3': 'Ita mhudumu',
      '4': 'Msaada kwa wateja',
      '5': 'Badilisha lugha',
      '6': 'Toka',
      '7': 'Tathmini ziara yako',
    },
    optBeauty: {
      '1': 'Tazama huduma',
      '2': 'Omba msaada / mapokezi',
      '3': 'Msaada kwa wateja',
      '4': 'Badilisha lugha',
      '5': 'Toka',
      '6': 'Tathmini ziara yako',
    },
    atRoot: 'Tayari uko kwenye menyu kuu.',
    back: 'Rudi.',
    exitThanks: 'Asante — kwaheri!',
    languageMenu: 'Choose language / Chagua lugha:\n1 — English\n2 — Kiswahili',
    languageSet: (l: string) => `Lugha imebadilishwa: ${l}.`,
    stub: 'Asante — tumepokea ombi lako.',
    menuSoon: 'Maelezo ya menyu yataonekana hapa baada ya kuweka orodha ya biashara.',
    foodNoCategories: 'Bado hakuna makundi ya menyu.',
    foodNoItems: 'Hakuna bidhaa katika jamii hii.',
    foodCategoriesTitle: 'Makundi ya menyu',
    foodItemsTitle: 'Bidhaa',
    foodUnavailable: 'hazipo',
    foodWaiterOk: 'Tumemtumia mhudumu — atakuja mezani pako hivi karibuni.',
    foodBillOk: 'Tunaandaa bili yako. Asante.',
    foodSupportOk: 'Ombi lako la msaada limehifadhiwa. Mfanyakazi atakusaidia.',
    foodNeedBranch:
      'Hatua hii inahitaji tawi au meza. QR yako haina tawi. Tafadhali skani QR ya **meza** au QR ya **biashara yenye tawi**, au uliza mfanyakazi.',
    beautyNoCategories: 'Bado hakuna makundi ya huduma.',
    beautyNoServices: 'Hakuna huduma katika jamii hii.',
    beautyCategoriesTitle: 'Makundi ya huduma',
    beautyServicesTitle: 'Huduma',
    beautyUnavailable: 'hazipo',
    beautyAssistanceOk: 'Tumetuma arifa mapokezi — mtu atakusaidia hivi karibuni.',
    beautySupportOk: 'Ujumbe wako umehifadhiwa. Timu yetu itafuatilia.',
    beautyNeedBranch:
      'Hatua hii inahitaji tawi au kituo. Skani QR ya **kituo** au QR ya **biashara yenye tawi**, au uliza mfanyakazi.',
    servicesSoon: 'Orodha ya huduma itaonekana hapa baada ya kuweka katalogi.',
    entryOpenFood: (biz: string, host?: string | null) =>
      `${host ? `Karibu *${biz}* — ${host} ni mwenyeji wako.\n\n` : `Karibu *${biz}*.\n\n`}Andika **1** kuona menyu na chaguo.`,
    entryOpenBeauty: (biz: string, host?: string | null) =>
      `${host ? `Karibu *${biz}* — ${host} yuko hapa kukusaidia.\n\n` : `Karibu *${biz}*.\n\n`}Andika **1** kuona huduma na chaguo.`,
    ratingTargetTitle: 'Ungependa kutathmini nini?',
    ratingOptBusiness: 'Mkahawa / biashara',
    ratingOptStaff: 'Mhudumu wako',
    ratingOptProvider: 'Mtoa huduma wako',
    ratingOptStaffAlt: 'Mfanyakazi',
    ratingOptService: 'Huduma au bidhaa maalum',
    ratingNoStaff: 'Hakuna mfanyakazi aliyeunganishwa na kipindi hiki — chagua kitu kingine.',
    ratingScorePrompt: (min: number, max: number) => `Weka alama ${min} hadi ${max} (au 0 kurudi).`,
    ratingCommentPrompt: 'Andika maoni mafupi (au 0 kuruka).',
    ratingCommentRequired: 'Maoni yanahitajika. Tafadhali andika maoni yako.',
    ratingThanks: 'Asante — tathmini yako imehifadhiwa.',
    ratingDuplicate: 'Tayari umewasilisha tathmini hii. Asante!',
    optSwitchToBeauty: 'Salon & urembo (badilisha)',
    optSwitchToFood: 'Mkahawa & chakula (badilisha)',
    optTipStaff: 'Tip kwa mfanyakazi (mitandao ya simu)',
    optPayWithMobile: 'Lipa bili (mitandao / USSD)',
    foodTipNeedStaffQr:
      'Kutuma tip, skani **QR ya mfanyakazi au mwenyeji** ili tumfahamu unayempa. Kisha chagua Tip tena.',
    foodTipAmountPrompt:
      'Andika **shillingi nzima** tu (nambari), mfano 5000.\n0 — Menyu kuu',
    foodTipAmountInvalid: 'Kiasi si halali. Andika nambari ya shillingi. 0 — Menyu kuu',
    foodTipPhonePrompt:
      'Andika **nambari ya simu** ya kutuma ujumbe wa malipo (mfano 07… au 255…).\n0 — Menyu kuu',
    foodTipPhoneInvalid: 'Nambari haijaeleweka. Jaribu 07… au 255…. 0 — Menyu kuu',
    foodTipUssdSent: 'Ombi la tip limetumwa. Thibitisha malipo kwenye simu yako.',
    foodPayNoOrder: 'Hakuna bili bado — ongeza bidhaa kutoka menyu (chaguo 1), kisha Lipa.',
    foodPayPhonePrompt: (orderNo: string, total: string) =>
      `Lipa **${orderNo}** — jumla **${total}**.\nAndika simu ya USSD (07… au 255…).\n0 — Menyu kuu`,
    foodPayUssdSent: 'Ujumbe wa malipo umetumwa. Kamilisha kwenye simu.',
    foodPayStillPending: 'Malipo bado hayajathibitishwa — thibitisha kwenye simu au subiri kidogo.',
    foodPayCompleted: 'Malipo yamepokelewa. Asante!',
    foodPayFailed: 'Malipo hayakufaulu. Unaweza jaribu Lipa tena kwenye menyu.',
    payStatusHint: 'Andika **P** kuona hali ya malipo ya mwisho.',
    optTipProvider: 'Tip kwa mstyli / mtoa huduma (mitandao ya simu)',
    optPayVisitUssd: 'Lipa kwa ziara yako (USSD / mitandao ya simu)',
    beautyTipNeedStaffQr:
      'Kutoa **tip**, skani **QR ya mstyli au mwenyeji** ili tumjue unayempa — kisha chagua Tip tena.',
    beautyTipAmountPrompt:
      'Unataka kutoa shillingi ngapi? Andika **shillingi nzima** tu (mfano 10000).\n0 — Menyu kuu',
    beautyTipAmountInvalid: 'Andika kiasi halali — nambari za shillingi pekee. 0 — Menyu kuu',
    beautyTipPhonePrompt:
      'Karibu tu! Andika **nambari ya simu** ya USSD (07… au 255…).\n0 — Menyu kuu',
    beautyTipPhoneInvalid: 'Nambari haijatambulika. Jaribu 07… au 255…. 0 — Menyu kuu',
    beautyTipUssdSent:
      'Angalia simu yako — thibitisha ombi la malipo. Asante kwa kuwa na ukarimu ✨',
    beautyPayNoBooking:
      'Bado hakuna malipo kwenye ziara — ongeza huduma kwa **1**, kisha urudi **Lipa kwa ziara**.',
    beautyPayPhonePrompt: (ref: string, total: string) =>
      `**${ref}** · jumla **${total}**\nSimu ya USSD (07… au 255…).\n0 — Menyu kuu`,
    beautyPayUssdSent: 'Ombi la malipo limetumwa — kamilisha kwenye simu.',
    beautyPayStillPending: 'Malipo bado yanafanyiwa — angalia simu. Andika **P** baadaye kuona hali.',
    beautyPayCompleted: 'Imekamilika — malipo yamepokelewa. Asante kwa kuja!',
    beautyPayFailed: 'Malipo hayakufanikiwa. Jaribu **Lipa kwa ziara** tena wakati wowote.',
  },
} as const;

export function t(lang: LangCode) {
  return STRINGS[lang];
}

export function formatNumberedMenu(
  lang: LangCode,
  category: 'FOOD_DINING' | 'BEAUTY_GROOMING',
  businessName: string,
  hostName?: string | null,
  extraOptions?: { digit: string; label: string }[],
): string {
  const s = t(lang);
  const lines: string[] = [];
  lines.push(s.welcome(businessName, hostName));
  lines.push('');
  lines.push(category === 'FOOD_DINING' ? s.mainFood : s.mainBeauty);
  lines.push('');
  const opts = category === 'FOOD_DINING' ? s.optFood : s.optBeauty;
  const keys = Object.keys(opts).sort((a, b) => Number(a) - Number(b));
  for (const k of keys) {
    lines.push(`${k} — ${opts[k as keyof typeof opts]}`);
  }
  for (const ex of extraOptions ?? []) {
    lines.push(`${ex.digit} — ${ex.label}`);
  }
  lines.push('');
  lines.push(lang === 'sw' ? '0 — Rudi nyuma' : '0 — Back');
  return lines.join('\n');
}
