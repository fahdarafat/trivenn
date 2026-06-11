'use strict';
const FLAG_PREDICATES_3 = [
  { key: 'flagcross', name: 'Features a cross', category: 'FLAG', tier: 'common', expect: 27, policy: 'A cross shape appears: upright crosses, Nordic crosses, saltires (diagonal X), and crosses inside cantons or coats of arms (the Union Jack in Australia/New Zealand/Fiji/Tuvalu cantons counts; Jamaica\'s saltire counts).', members: ['BDI', 'DMA', 'DOM', 'JAM', 'GEO', 'DNK', 'FIN', 'GRC', 'ISL', 'LIE', 'MLT', 'MDA', 'MNE', 'NOR', 'SMR', 'SRB', 'SVK', 'ESP', 'SWE', 'CHE', 'GBR', 'VAT', 'AUS', 'FJI', 'NZL', 'TON', 'TUV'] },
  { key: 'flaganimal', name: 'Features an animal', category: 'FLAG', tier: 'common', expect: 23, policy: 'A real or mythical creature appears on the flag, including inside coats of arms: birds, lions, dragons, snakes, fish. Plants and humans do not count.', members: ['EGY', 'UGA', 'ZMB', 'ZWE', 'BOL', 'DMA', 'ECU', 'GTM', 'MEX', 'BTN', 'KAZ', 'LKA', 'ALB', 'AND', 'HRV', 'MLT', 'MDA', 'MNE', 'SRB', 'ESP', 'FJI', 'KIR', 'PNG'] },
];
module.exports = { FLAG_PREDICATES_3 };
