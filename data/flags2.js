// Verified flag predicates (sweep of all 197 canon flags, June 2026).
// Sources: Wikipedia "List of national flags by design" (Star / Moon / Sun sections),
// per-country flag and coat-of-arms articles, worldpopulationreview star-count list,
// WorldAtlas sun/star articles. Judged on the national flag as shown by the flag emoji.
'use strict';
const FLAG_PREDICATES_2 = [
  {
    key: 'flagonestar',
    name: 'Exactly one star on the flag',
    category: 'FLAG',
    tier: 'common',
    expect: 38,
    policy: 'Precisely one star shape, counting stars of any number of points (Israel\'s six-pointed star and Jordan\'s seven-pointed star count) and stars inside emblems or coats of arms. Flags with zero or multiple stars are out.',
    members: [
      // Africa (21)
      'DZA', 'AGO', 'BFA', 'CMR', 'CAF', 'COD', 'DJI', 'ETH', 'GHA', 'GNB',
      'LBR', 'LBY', 'MRT', 'MAR', 'MOZ', 'SEN', 'SOM', 'SSD', 'TGO', 'TUN', 'ZWE',
      // Americas (4)
      'CHL', 'CUB', 'PRY', 'SUR',
      // Asia (10)
      'AZE', 'ISR', 'JOR', 'MYS', 'MMR', 'PAK', 'PRK', 'TLS', 'TUR', 'VNM',
      // Europe (1)
      'MDA',
      // Oceania (2)
      'MHL', 'NRU',
    ],
  },
  {
    key: 'flagsun',
    name: 'Features a sun',
    category: 'FLAG',
    tier: 'common',
    expect: 20,
    policy: 'A sun appears on the flag: suns with rays or faces, and plain discs officially defined as suns (Japan, Bangladesh, Palau is a MOON so it is out, Laos disc is the moon so it is out, Niger\'s orange disc is a sun so it is in).',
    members: [
      // Africa (4)
      'MWI', 'NAM', 'NER', 'RWA',
      // Americas (6)
      'ARG', 'ATG', 'BOL', 'CRI', 'ECU', 'URY',
      // Asia (8)
      'BGD', 'JPN', 'KAZ', 'KGZ', 'MNG', 'NPL', 'PHL', 'TWN',
      // Europe (1)
      'MKD',
      // Oceania (1)
      'KIR',
    ],
  },
];
module.exports = { FLAG_PREDICATES_2 };
