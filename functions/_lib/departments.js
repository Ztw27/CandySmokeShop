// Groups Lightspeed's categories into shopper-friendly departments with clean names.
// Keys are Lightspeed category names (lower-case). Anything not listed lands in "More".
// To move or rename a category, edit its line here — nothing in Lightspeed needs to change.

export const DEPARTMENTS = [
  { id: 'vapes', name: 'Vapes', icon: '💨' },
  { id: 'glass', name: 'Glass & Pipes', icon: '🔮' },
  { id: 'dab', name: 'Dab Gear', icon: '💎' },
  { id: 'papers', name: 'Papers & Wraps', icon: '📜' },
  { id: 'tobacco', name: 'Tobacco & Nicotine', icon: '🚬' },
  { id: 'hookah', name: 'Hookah', icon: '🪔' },
  { id: 'accessories', name: 'Accessories', icon: '🔥' },
  { id: 'lifestyle', name: 'Home & Lifestyle', icon: '🕯️' },
  { id: 'hemp', name: 'Hemp & Wellness', icon: '🌿' },
  { id: 'more', name: 'More', icon: '✨' },
];

const MAP = {
  // Vapes
  'disposable device': ['vapes', 'Disposable Vapes'],
  'geek bar pulse': ['vapes', 'Geek Bar'],
  'geek bar pulse x': ['vapes', 'Geek Bar'],
  'geek bar pulse 2': ['vapes', 'Geek Bar'],
  'geek bar pulse x 2': ['vapes', 'Geek Bar'],
  'salt': ['vapes', 'Salt Nic E-Liquid'],
  'e-juice': ['vapes', 'E-Liquid'],
  'coli & pods': ['vapes', 'Coils & Pods'],
  'foger pod': ['vapes', 'Foger Pods'],
  'foger kit': ['vapes', 'Foger Kits'],
  'salt device': ['vapes', 'Pod Systems'],
  'vape device': ['vapes', 'Mods & Kits'],
  'juul': ['vapes', 'JUUL'],
  'cali pods': ['vapes', 'Cali Pods'],
  'vaporizer coli & tank': ['vapes', 'Coils & Tanks'],
  'tank & glass tank': ['vapes', 'Coils & Tanks'],
  'battery cartridge': ['vapes', '510 Batteries'],
  'battery & charger': ['vapes', 'Batteries & Chargers'],
  'chargers': ['vapes', 'Batteries & Chargers'],
  'cartridge': ['vapes', 'Empty Cartridges'],
  'dry device': ['vapes', 'Dry Herb Vaporizers'],
  'vaporizer': ['vapes', 'Dry Herb Vaporizers'],
  'wax device': ['vapes', 'Wax Pens'],
  'dabb pen': ['vapes', 'Wax Pens'],

  // Glass & Pipes
  'water pipe glass': ['glass', 'Glass Water Pipes'],
  'water pipe silicone': ['glass', 'Silicone Water Pipes'],
  'water pipe plastic': ['glass', 'Acrylic Water Pipes'],
  'hand pipe glass': ['glass', 'Glass Hand Pipes'],
  'glass pipe': ['glass', 'Glass Hand Pipes'],
  'glass': ['glass', 'Glass'],
  'hand pipe silicone': ['glass', 'Silicone Hand Pipes'],
  'hand pipe wood&metal': ['glass', 'Wood & Metal Pipes'],
  'bubbler': ['glass', 'Bubblers'],
  'chillums': ['glass', 'Chillums'],
  'one hitter': ['glass', 'One Hitters'],
  'dugout': ['glass', 'Dugouts'],
  'grav': ['glass', 'GRAV'],
  'oil burner pip': ['glass', 'Oil Burners'],
  'w.p oil burner': ['glass', 'Oil Burners'],
  'bowls': ['glass', 'Bowls'],
  'downstem': ['glass', 'Downstems'],
  'ash catcher': ['glass', 'Ash Catchers'],
  'glass cleaner': ['glass', 'Cleaners'],

  // Dab Gear
  'nectar collector': ['dab', 'Nectar Collectors'],
  'bangers': ['dab', 'Bangers'],
  'cap': ['dab', 'Carb Caps'],
  'wax': ['dab', 'Wax'],
  'mat': ['dab', 'Dab Mats'],
  'concentrates': ['dab', 'Dab Tools'],

  // Papers & Wraps
  'raw': ['papers', 'RAW'],
  'paper': ['papers', 'Rolling Papers'],
  'zig zag': ['papers', 'Zig-Zag'],
  'papers & wraps': ['papers', 'Rolling Papers'],
  'cone': ['papers', 'Cones'],
  'cone filler': ['papers', 'Cone Fillers'],
  'blunts': ['papers', 'Blunt Wraps'],
  'wraps': ['papers', 'Wraps'],
  'backwoods': ['papers', 'Backwoods'],
  'king palm': ['papers', 'King Palm'],
  'tips': ['papers', 'Tips & Filters'],
  'rolling trays': ['papers', 'Rolling Trays'],
  'rolling machine': ['papers', 'Rolling Machines'],
  'machine': ['papers', 'Rolling Machines'],

  // Tobacco & Nicotine
  'tobacco': ['tobacco', 'Tobacco'],
  'cigarettes': ['tobacco', 'Cigarettes'],
  'pouches': ['tobacco', 'Nicotine Pouches'],

  // Hookah
  'hookah': ['hookah', 'Hookahs'],
  'hose': ['hookah', 'Hoses'],
  'charcoal': ['hookah', 'Coals'],

  // Accessories
  'accessory': ['accessories', 'Accessories'],
  'accessories': ['accessories', 'Accessories'],
  'grinder': ['accessories', 'Grinders'],
  'torch': ['accessories', 'Torches'],
  'lighter': ['accessories', 'Lighters'],
  'butane': ['accessories', 'Butane'],
  'scale': ['accessories', 'Scales'],
  'ashtrays': ['accessories', 'Ashtrays'],
  'bag': ['accessories', 'Bags & Cases'],
  'containers': ['accessories', 'Storage'],
  'jar': ['accessories', 'Storage'],
  'safe container': ['accessories', 'Stash Safes'],
  'boveda': ['accessories', 'Humidity Packs'],
  'smoke buddy': ['accessories', 'Smoke Buddy'],

  // Home & Lifestyle
  'incense': ['lifestyle', 'Incense'],
  'candles': ['lifestyle', 'Candles'],
  'air fresheners': ['lifestyle', 'Air Fresheners'],
  'detox': ['lifestyle', 'Detox'],
  'body': ['lifestyle', 'Body'],
  'whip it': ['lifestyle', 'Whip-It'],

  // Hemp & Wellness
  'flower': ['hemp', 'Hemp Flower'],
  'pre-roll': ['hemp', 'Pre-Rolls'],
  'gummies': ['hemp', 'Gummies'],
  'hemp': ['hemp', 'Hemp'],
  'cbd & delta 8': ['hemp', 'CBD & Delta 8'],
  'tincture': ['hemp', 'Tinctures'],
  'capsule': ['hemp', 'Capsules'],
  'powder': ['hemp', 'Powders'],
};

const titleCase = s => s.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());

export function classify(category) {
  const raw = String(category || '').trim();
  const hit = MAP[raw.toLowerCase()];
  return hit ? { dept: hit[0], sub: hit[1] } : { dept: 'more', sub: raw ? titleCase(raw) : 'Other' };
}
