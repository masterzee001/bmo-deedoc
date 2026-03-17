export type NigeriaGeoPoliticalZone = {
  id: string;
  name: string;
};

export type NigeriaStateReference = {
  id: string;
  name: string;
  inecCode: string;
  geoPoliticalZoneId: string;
};

export const NIGERIA_GEO_POLITICAL_ZONES: NigeriaGeoPoliticalZone[] = [
  { id: "ng-zone-north-central", name: "North Central" },
  { id: "ng-zone-north-east", name: "North East" },
  { id: "ng-zone-north-west", name: "North West" },
  { id: "ng-zone-south-east", name: "South East" },
  { id: "ng-zone-south-south", name: "South South" },
  { id: "ng-zone-south-west", name: "South West" },
];

export const NIGERIA_STATE_REFERENCE: NigeriaStateReference[] = [
  { id: "ng-state-abia", name: "Abia", inecCode: "1", geoPoliticalZoneId: "ng-zone-south-east" },
  { id: "ng-state-adamawa", name: "Adamawa", inecCode: "2", geoPoliticalZoneId: "ng-zone-north-east" },
  { id: "ng-state-akwa-ibom", name: "Akwa Ibom", inecCode: "3", geoPoliticalZoneId: "ng-zone-south-south" },
  { id: "ng-state-anambra", name: "Anambra", inecCode: "4", geoPoliticalZoneId: "ng-zone-south-east" },
  { id: "ng-state-bauchi", name: "Bauchi", inecCode: "5", geoPoliticalZoneId: "ng-zone-north-east" },
  { id: "ng-state-bayelsa", name: "Bayelsa", inecCode: "6", geoPoliticalZoneId: "ng-zone-south-south" },
  { id: "ng-state-benue", name: "Benue", inecCode: "7", geoPoliticalZoneId: "ng-zone-north-central" },
  { id: "ng-state-borno", name: "Borno", inecCode: "8", geoPoliticalZoneId: "ng-zone-north-east" },
  { id: "ng-state-cross-river", name: "Cross River", inecCode: "9", geoPoliticalZoneId: "ng-zone-south-south" },
  { id: "ng-state-delta", name: "Delta", inecCode: "10", geoPoliticalZoneId: "ng-zone-south-south" },
  { id: "ng-state-ebonyi", name: "Ebonyi", inecCode: "11", geoPoliticalZoneId: "ng-zone-south-east" },
  { id: "ng-state-edo", name: "Edo", inecCode: "12", geoPoliticalZoneId: "ng-zone-south-south" },
  { id: "ng-state-ekiti", name: "Ekiti", inecCode: "13", geoPoliticalZoneId: "ng-zone-south-west" },
  { id: "ng-state-enugu", name: "Enugu", inecCode: "14", geoPoliticalZoneId: "ng-zone-south-east" },
  { id: "ng-state-fct", name: "FCT", inecCode: "15", geoPoliticalZoneId: "ng-zone-north-central" },
  { id: "ng-state-gombe", name: "Gombe", inecCode: "16", geoPoliticalZoneId: "ng-zone-north-east" },
  { id: "ng-state-imo", name: "Imo", inecCode: "17", geoPoliticalZoneId: "ng-zone-south-east" },
  { id: "ng-state-jigawa", name: "Jigawa", inecCode: "18", geoPoliticalZoneId: "ng-zone-north-west" },
  { id: "ng-state-kaduna", name: "Kaduna", inecCode: "19", geoPoliticalZoneId: "ng-zone-north-west" },
  { id: "ng-state-kano", name: "Kano", inecCode: "20", geoPoliticalZoneId: "ng-zone-north-west" },
  { id: "ng-state-katsina", name: "Katsina", inecCode: "21", geoPoliticalZoneId: "ng-zone-north-west" },
  { id: "ng-state-kebbi", name: "Kebbi", inecCode: "22", geoPoliticalZoneId: "ng-zone-north-west" },
  { id: "ng-state-kogi", name: "Kogi", inecCode: "23", geoPoliticalZoneId: "ng-zone-north-central" },
  { id: "ng-state-kwara", name: "Kwara", inecCode: "24", geoPoliticalZoneId: "ng-zone-north-central" },
  { id: "ng-state-lagos", name: "Lagos", inecCode: "25", geoPoliticalZoneId: "ng-zone-south-west" },
  { id: "ng-state-nasarawa", name: "Nasarawa", inecCode: "26", geoPoliticalZoneId: "ng-zone-north-central" },
  { id: "ng-state-niger", name: "Niger", inecCode: "27", geoPoliticalZoneId: "ng-zone-north-central" },
  { id: "ng-state-ogun", name: "Ogun", inecCode: "28", geoPoliticalZoneId: "ng-zone-south-west" },
  { id: "ng-state-ondo", name: "Ondo", inecCode: "29", geoPoliticalZoneId: "ng-zone-south-west" },
  { id: "ng-state-osun", name: "Osun", inecCode: "30", geoPoliticalZoneId: "ng-zone-south-west" },
  { id: "ng-state-oyo", name: "Oyo", inecCode: "31", geoPoliticalZoneId: "ng-zone-south-west" },
  { id: "ng-state-plateau", name: "Plateau", inecCode: "32", geoPoliticalZoneId: "ng-zone-north-central" },
  { id: "ng-state-rivers", name: "Rivers", inecCode: "33", geoPoliticalZoneId: "ng-zone-south-south" },
  { id: "ng-state-sokoto", name: "Sokoto", inecCode: "34", geoPoliticalZoneId: "ng-zone-north-west" },
  { id: "ng-state-taraba", name: "Taraba", inecCode: "35", geoPoliticalZoneId: "ng-zone-north-east" },
  { id: "ng-state-yobe", name: "Yobe", inecCode: "36", geoPoliticalZoneId: "ng-zone-north-east" },
  { id: "ng-state-zamfara", name: "Zamfara", inecCode: "37", geoPoliticalZoneId: "ng-zone-north-west" },
];

export const NIGERIA_STATE_EXPECTED_LGA_COUNTS: Record<string, number> = {
  "ng-state-abia": 17,
  "ng-state-adamawa": 21,
  "ng-state-akwa-ibom": 31,
  "ng-state-anambra": 21,
  "ng-state-bauchi": 20,
  "ng-state-bayelsa": 8,
  "ng-state-benue": 23,
  "ng-state-borno": 27,
  "ng-state-cross-river": 18,
  "ng-state-delta": 25,
  "ng-state-ebonyi": 13,
  "ng-state-edo": 18,
  "ng-state-ekiti": 16,
  "ng-state-enugu": 17,
  "ng-state-fct": 6,
  "ng-state-gombe": 11,
  "ng-state-imo": 27,
  "ng-state-jigawa": 27,
  "ng-state-kaduna": 23,
  "ng-state-kano": 44,
  "ng-state-katsina": 34,
  "ng-state-kebbi": 21,
  "ng-state-kogi": 21,
  "ng-state-kwara": 16,
  "ng-state-lagos": 20,
  "ng-state-nasarawa": 13,
  "ng-state-niger": 25,
  "ng-state-ogun": 20,
  "ng-state-ondo": 18,
  "ng-state-osun": 30,
  "ng-state-oyo": 33,
  "ng-state-plateau": 17,
  "ng-state-rivers": 23,
  "ng-state-sokoto": 23,
  "ng-state-taraba": 16,
  "ng-state-yobe": 17,
  "ng-state-zamfara": 14,
};

export const NIGERIA_EXPECTED_STATE_TOTAL = NIGERIA_STATE_REFERENCE.length;
export const NIGERIA_EXPECTED_LGA_TOTAL = Object.values(NIGERIA_STATE_EXPECTED_LGA_COUNTS).reduce(
  (sum, count) => sum + count,
  0,
);
