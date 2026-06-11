// Trivenn predicate definitions.
// Each predicate: id, name (shown at reveal), category, tier ('common'|'expert'),
// policy (the published edge-case ruling, shown in Decoder receipts), and either
//   members: explicit array of country IDs, or
//   derive: name of a build-time derivation over the canon (zero fact risk).
// Member lists are the single source of truth — the build script compiles them to bits
// and asserts the count matches `expect` (drift alarm for future edits).
'use strict';
const PREDICATES = [
  // ====================== MAP ======================
  {
    key: 'landlocked', name: 'Landlocked', category: 'MAP', tier: 'common', expect: 45,
    policy: 'No coastline on any ocean or open sea. Caspian-only states (Azerbaijan, Kazakhstan, Turkmenistan) count as landlocked.',
    members: ['AND','AUT','BLR','CZE','HUN','XKX','LIE','LUX','MDA','MKD','SMR','SRB','SVK','CHE','VAT',
              'AFG','ARM','AZE','BTN','KAZ','KGZ','LAO','MNG','NPL','TJK','TKM','UZB',
              'BWA','BFA','BDI','CAF','TCD','SWZ','ETH','LSO','MWI','MLI','NER','RWA','SSD','UGA','ZMB','ZWE',
              'BOL','PRY'],
  },
  {
    key: 'island', name: 'Island nation', category: 'MAP', tier: 'common', expect: 47,
    policy: 'Territory lies entirely on islands. Australia counts as a continental landmass, not an island. Sharing an island with another country (Haiti, Brunei, Ireland) still counts.',
    members: ['ISL','IRL','GBR','MLT','CYP',
              'CPV','COM','MDG','MUS','STP','SYC',
              'ATG','BHS','BRB','CUB','DMA','DOM','GRD','HTI','JAM','KNA','LCA','VCT','TTO',
              'BHR','BRN','IDN','JPN','MDV','PHL','SGP','LKA','TWN','TLS',
              'FJI','KIR','MHL','FSM','NRU','NZL','PLW','PNG','WSM','SLB','TON','TUV','VUT'],
  },
  {
    key: 'equator', name: 'The equator passes through it', category: 'MAP', tier: 'common', expect: 13,
    policy: 'The equator crosses its land or territorial waters. Maldives and Kiribati are in; Equatorial Guinea, despite the name, is not.',
    members: ['ECU','COL','BRA','STP','GAB','COG','COD','UGA','KEN','SOM','MDV','IDN','KIR'],
  },
  {
    key: 'capsouth', name: 'Capital in the Southern Hemisphere', category: 'MAP', tier: 'common', expect: 40,
    policy: "Judged by the capital city's latitude. Quito (Ecuador) is just south of the equator — in. Kampala, Libreville and São Tomé are just north — out.",
    members: ['BRA','BOL','PER','PRY','ARG','URY','CHL','ECU',
              'AGO','BDI','BWA','COM','COD','COG','KEN','LSO','MDG','MWI','MUS','MOZ','NAM','RWA','SYC','ZAF','SWZ','TZA','ZMB','ZWE',
              'IDN','TLS',
              'AUS','FJI','NZL','PNG','WSM','SLB','TON','TUV','VUT','NRU'],
  },
  {
    key: 'brussia', name: 'Borders Russia', category: 'MAP', tier: 'common', expect: 14,
    policy: 'Shares a land border with Russia, including with the Kaliningrad exclave (Poland, Lithuania). A country never borders itself.',
    members: ['NOR','FIN','EST','LVA','LTU','POL','BLR','UKR','GEO','AZE','KAZ','MNG','CHN','PRK'],
  },
  {
    key: 'bchina', name: 'Borders China', category: 'MAP', tier: 'common', expect: 14,
    policy: 'Shares a land border with China. A country never borders itself.',
    members: ['RUS','MNG','KAZ','KGZ','TJK','AFG','PAK','IND','NPL','BTN','MMR','LAO','VNM','PRK'],
  },
  {
    key: 'bbrazil', name: 'Borders Brazil', category: 'MAP', tier: 'common', expect: 10,
    policy: 'Shares a land border with Brazil. France counts via French Guiana. A country never borders itself.',
    members: ['FRA','SUR','GUY','VEN','COL','PER','BOL','PRY','ARG','URY'],
  },
  {
    key: 'bone', name: 'Borders exactly one country', category: 'MAP', tier: 'common', expect: 15,
    policy: 'Has precisely one land neighbor. Causeways and bridges (Singapore, Bahrain) are not land borders. Canada and Denmark are out: they have shared a land border on Hans Island since 2022.',
    members: ['GMB','HTI','DOM','IRL','GBR','LSO','MCO','PNG','PRT','QAT','SMR','KOR','TLS','VAT','BRN'],
  },
  {
    key: 'med', name: 'Mediterranean coastline', category: 'MAP', tier: 'common', expect: 22,
    policy: 'Has a coastline on the Mediterranean Sea proper. Palestine counts via the Gaza Strip. Portugal and Jordan do not touch the Mediterranean.',
    members: ['ESP','FRA','MCO','ITA','MLT','SVN','HRV','BIH','MNE','ALB','GRC','CYP','TUR','SYR','LBN','ISR','PSE','EGY','LBY','TUN','DZA','MAR'],
  },
  {
    key: 'americas', name: 'In the Americas', category: 'MAP', tier: 'common', expect: 35,
    policy: 'North, Central, or South America, including the Caribbean.',
    derive: 'region:AM',
  },
  {
    key: 'africa', name: 'In Africa', category: 'MAP', tier: 'common', expect: 54,
    policy: 'On the African continent or its surrounding islands.',
    derive: 'region:AF',
  },
  {
    key: 'top10area', name: 'Top 10 largest by area', category: 'MAP', tier: 'common', expect: 10,
    policy: 'Total area including inland water, per the CIA World Factbook ranking.',
    members: ['RUS','CAN','USA','CHN','BRA','AUS','IND','ARG','KAZ','DZA'],
  },
  // ====================== SOCIETY ======================
  {
    key: 'eu', name: 'Member of the European Union', category: 'SOCIETY', tier: 'common', expect: 27,
    policy: 'The 27 EU member states as of 2026. Candidates and EEA members (Norway, Iceland, Switzerland) do not count.',
    members: ['AUT','BEL','BGR','HRV','CYP','CZE','DNK','EST','FIN','FRA','DEU','GRC','HUN','IRL','ITA','LVA','LTU','LUX','MLT','NLD','POL','PRT','ROU','SVK','SVN','ESP','SWE'],
  },
  {
    key: 'monarchy', name: 'Monarchy', category: 'SOCIETY', tier: 'common', expect: 41,
    policy: 'A royal head of state, including the 15 Commonwealth realms and elective monarchies Malaysia and Cambodia. Vatican City (elected pope) and Andorra (co-princes) are excluded.',
    members: ['ATG','AUS','BHS','BLZ','CAN','GRD','JAM','NZL','PNG','KNA','LCA','VCT','SLB','TUV','GBR',
              'BHR','BEL','BTN','BRN','KHM','DNK','SWZ','JPN','JOR','KWT','LSO','LIE','LUX','MYS','MCO','MAR','NLD','NOR','OMN','QAT','SAU','ESP','SWE','THA','TON','ARE'],
  },
  {
    key: 'drivesleft', name: 'Drives on the left', category: 'SOCIETY', tier: 'expert', expect: 54,
    policy: 'Road traffic keeps to the left, per current national traffic law. Samoa switched to the left in 2009. Myanmar drives on the right.',
    members: ['GBR','IRL','MLT','CYP',
              'ZAF','NAM','BWA','ZWE','ZMB','MWI','MOZ','TZA','KEN','UGA','LSO','SWZ','MUS','SYC',
              'IND','PAK','BGD','LKA','NPL','BTN','MDV','IDN','MYS','SGP','BRN','THA','JPN','TLS',
              'AUS','NZL','FJI','KIR','SLB','TON','TUV','WSM','NRU','PNG',
              'GUY','SUR','JAM','TTO','BHS','BRB','ATG','DMA','GRD','KNA','LCA','VCT'],
  },
  {
    key: 'spanish', name: 'Spanish is an official language', category: 'SOCIETY', tier: 'common', expect: 20,
    policy: 'Official or primary national language. Mexico has no de jure official language; Spanish counts as its national language. Equatorial Guinea is in.',
    members: ['ESP','MEX','GTM','SLV','HND','NIC','CRI','PAN','CUB','DOM','COL','VEN','ECU','PER','BOL','PRY','URY','ARG','CHL','GNQ'],
  },
  {
    key: 'french', name: 'French is an official language', category: 'SOCIETY', tier: 'common', expect: 26,
    policy: 'French has official status nationally. Mali (2023), Burkina Faso (2023) and Niger (2025) demoted French to a working language and do not count; nor do Mauritania or Algeria.',
    members: ['FRA','BEL','CHE','LUX','MCO','CAN','HTI',
              'BEN','BDI','CMR','CAF','TCD','COM','COG','COD','CIV','DJI','GAB','GIN','MDG','RWA','SEN','SYC','TGO','GNQ',
              'VUT'],
  },
  {
    key: 'arabic', name: 'Arabic is an official language', category: 'SOCIETY', tier: 'common', expect: 24,
    policy: 'Arabic has official or co-official status nationally. Israel (special status since 2018) and South Sudan do not count. Eritrea counts (working language).',
    members: ['DZA','BHR','COM','DJI','EGY','IRQ','JOR','KWT','LBN','LBY','MRT','MAR','OMN','PSE','QAT','SAU','SOM','SDN','SYR','TUN','ARE','YEM','TCD','ERI'],
  },
  {
    key: 'euro', name: 'The euro is its official currency', category: 'SOCIETY', tier: 'common', expect: 27,
    policy: 'Sole legal tender: the 21 eurozone members (Bulgaria joined January 2026), the four micro-states with monetary agreements (Andorra, Monaco, San Marino, Vatican), and unilateral adopters Kosovo and Montenegro.',
    members: ['AUT','BEL','BGR','HRV','CYP','EST','FIN','FRA','DEU','GRC','IRL','ITA','LVA','LTU','LUX','MLT','NLD','PRT','SVK','SVN','ESP',
              'AND','MCO','SMR','VAT','XKX','MNE'],
  },
  {
    key: 'nato', name: 'NATO member', category: 'SOCIETY', tier: 'common', expect: 32,
    policy: 'The 32 NATO members as of 2026, including Finland (2023) and Sweden (2024).',
    members: ['ALB','BEL','BGR','CAN','HRV','CZE','DNK','EST','FIN','FRA','DEU','GRC','HUN','ISL','ITA','LVA','LTU','LUX','MNE','NLD','MKD','NOR','POL','PRT','ROU','SVK','SVN','ESP','SWE','TUR','GBR','USA'],
  },
  {
    key: 'opec', name: 'OPEC member', category: 'SOCIETY', tier: 'expert', expect: 11,
    policy: 'The 11 OPEC members as of June 2026. The UAE left in May 2026, Angola in 2024, Ecuador in 2020, Qatar in 2019.',
    members: ['DZA','COG','GNQ','GAB','IRN','IRQ','KWT','LBY','NGA','SAU','VEN'],
  },
  {
    key: 'pop100m', name: 'Population over 100 million', category: 'SOCIETY', tier: 'common', expect: 16,
    policy: 'UN World Population Prospects 2024 estimates. Vietnam and DR Congo are in; Iran and Turkey (~88M) are not.',
    members: ['CHN','IND','USA','IDN','PAK','NGA','BRA','BGD','RUS','MEX','ETH','JPN','PHL','EGY','COD','VNM'],
  },
  {
    key: 'popu1m', name: 'Population under 1 million', category: 'SOCIETY', tier: 'common', expect: 37,
    policy: 'UN World Population Prospects 2024 estimates. Fiji and Guyana sit just under the line; Cyprus, Djibouti and Eswatini are just over.',
    members: ['VAT','TUV','NRU','PLW','SMR','MCO','LIE','MHL','KNA','DMA','AND','ATG','SYC','TON','FSM','GRD','VCT','KIR','WSM','STP','VUT','BRB','ISL','MDV','MLT','BHS','BLZ','BRN','CPV','SLB','MNE','LUX','SUR','BTN','GUY','COM','FJI'],
  },
  // ====================== NAME (derived at build time — zero fact risk) ======================
  {
    key: 'nameland', name: "Name contains 'LAND'", category: 'NAME', tier: 'common', expect: 10,
    policy: "The letters L-A-N-D appear consecutively in the country's common English name.",
    derive: 'name-contains:land',
  },
  {
    key: 'namestan', name: "Name ends in '-STAN'", category: 'NAME', tier: 'common', expect: 7,
    policy: "The common English name ends in 'stan'.",
    derive: 'name-ends:stan',
  },
  {
    key: 'nameshort', name: 'Name has 5 letters or fewer', category: 'NAME', tier: 'common', expect: 34,
    policy: "Letters in the common English name as shown in the game's country picker, ignoring spaces and punctuation.",
    derive: 'name-short:5',
  },
  {
    key: 'namesame', name: 'Name starts and ends with the same letter', category: 'NAME', tier: 'common', expect: 0,
    policy: "First and last letter of the common English name match, case-insensitive ('Austria', 'Seychelles').",
    derive: 'name-same-letter',
  },
  {
    key: 'capshares', name: 'Capital shares the country’s name', category: 'NAME', tier: 'common', expect: 0,
    policy: "The capital's name contains the country's name as a whole word, or vice versa (Mexico City, Kuwait City, Andorra la Vella, São Tomé). Tunis/Tunisia does not count — partial-word matches are out.",
    derive: 'cap-shares',
  },
  {
    key: 'capsameletter', name: 'Capital starts with the country’s first letter', category: 'NAME', tier: 'common', expect: 0,
    policy: "First letter of the capital matches the first letter of the country's name (Brazil → Brasília, Sweden → Stockholm). Accents are ignored.",
    derive: 'cap-same-letter',
  },
  {
    key: 'namedouble', name: 'Name has a double letter', category: 'NAME', tier: 'common', expect: 0,
    policy: "The same letter appears twice in a row in the common English name (GrEEce, MoroCCo, RuSSia). Spaces are ignored, so it must be within one word.",
    derive: 'name-double',
  },
  // ====================== FLAG (authored by research agents, verified) ======================
  // PLACEHOLDER: filled by data/flags.js after the research pass.
  // ====================== SPORT & CULTURE ======================
  {
    key: 'wcwinner', name: 'Has won the FIFA World Cup', category: 'SPORT', tier: 'expert', expect: 8,
    policy: "Men's tournament. England's 1966 title credits the United Kingdom; West Germany's titles credit Germany.",
    members: ['URY','ITA','DEU','BRA','GBR','ARG','FRA','ESP'],
  },
  {
    key: 'olyhost', name: 'Has hosted a Summer Olympics', category: 'SPORT', tier: 'expert', expect: 19,
    policy: 'Host nation of a Summer Games through 2024. The 1980 Moscow Games credit Russia.',
    members: ['GRC','FRA','USA','GBR','SWE','BEL','NLD','DEU','FIN','AUS','ITA','JPN','MEX','CAN','RUS','KOR','ESP','CHN','BRA'],
  },
  {
    key: 'wchost', name: 'Has hosted a FIFA World Cup', category: 'SPORT', tier: 'expert', expect: 19,
    policy: "Host of a men's World Cup through the 2026 tournament (USA, Canada, Mexico). England 1966 credits the United Kingdom.",
    members: ['URY','ITA','FRA','BRA','CHE','SWE','CHL','GBR','MEX','DEU','ARG','ESP','USA','JPN','KOR','ZAF','RUS','QAT','CAN'],
  },
];
module.exports = { PREDICATES };
