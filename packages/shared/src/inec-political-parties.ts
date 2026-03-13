export type InecPoliticalPartyReference = {
  id: string;
  code: string;
  name: string;
  inecSourceUrl: string;
};

// Current INEC political party index pages captured from the official site on 2026-03-13.
export const INEC_POLITICAL_PARTIES: InecPoliticalPartyReference[] = [
  { id: "inec-party-aa", code: "AA", name: "Action Alliance", inecSourceUrl: "https://inecnigeria.org/political-parties/" },
  { id: "inec-party-aac", code: "AAC", name: "African Action Congress", inecSourceUrl: "https://inecnigeria.org/political-parties/" },
  { id: "inec-party-adc", code: "ADC", name: "African Democratic Congress", inecSourceUrl: "https://inecnigeria.org/political-parties/" },
  { id: "inec-party-apm", code: "APM", name: "Allied Peoples Movement", inecSourceUrl: "https://inecnigeria.org/political-parties/" },
  { id: "inec-party-apc", code: "APC", name: "All Progressives Congress", inecSourceUrl: "https://inecnigeria.org/political-parties/" },
  { id: "inec-party-bp", code: "BP", name: "Boot Party", inecSourceUrl: "https://inecnigeria.org/political-parties/" },
  { id: "inec-party-lp", code: "LP", name: "Labour Party", inecSourceUrl: "https://inecnigeria.org/political-parties/" },
  { id: "inec-party-nnpp", code: "NNPP", name: "New Nigeria Peoples Party", inecSourceUrl: "https://inecnigeria.org/political-parties/" },
  { id: "inec-party-pdp", code: "PDP", name: "Peoples Democratic Party", inecSourceUrl: "https://inecnigeria.org/political-parties/" },
  { id: "inec-party-ndc", code: "NDC", name: "National Democratic Congress", inecSourceUrl: "https://inecnigeria.org/political-parties/" },
  { id: "inec-party-accord", code: "ACCORD", name: "Accord", inecSourceUrl: "https://inecnigeria.org/political-parties/page/2/" },
  { id: "inec-party-apga", code: "APGA", name: "All Progressives Grand Alliance", inecSourceUrl: "https://inecnigeria.org/political-parties/page/2/" },
  { id: "inec-party-nrm", code: "NRM", name: "National Rescue Movement", inecSourceUrl: "https://inecnigeria.org/political-parties/page/2/" },
  { id: "inec-party-prp", code: "PRP", name: "Peoples Redemption Party", inecSourceUrl: "https://inecnigeria.org/political-parties/page/2/" },
  { id: "inec-party-sdp", code: "SDP", name: "Social Democratic Party", inecSourceUrl: "https://inecnigeria.org/political-parties/page/2/" },
  { id: "inec-party-ypp", code: "YPP", name: "Young Progressive Party", inecSourceUrl: "https://inecnigeria.org/political-parties/page/2/" },
  { id: "inec-party-yp", code: "YP", name: "Youth Party", inecSourceUrl: "https://inecnigeria.org/political-parties/page/2/" },
  { id: "inec-party-zlp", code: "ZLP", name: "Zenith Labour Party", inecSourceUrl: "https://inecnigeria.org/political-parties/page/2/" },
  { id: "inec-party-adp", code: "ADP", name: "Action Democratic Party", inecSourceUrl: "https://inecnigeria.org/political-parties/page/2/" },
  { id: "inec-party-app", code: "APP", name: "Action Peoples Party", inecSourceUrl: "https://inecnigeria.org/political-parties/page/2/" },
];
