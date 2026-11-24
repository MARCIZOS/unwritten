// Realistic expert answers across six skills. `expect` = cue types a good apprentice should notice
// (any one is enough); `none: true` = a plain, precise answer that should NOT trigger a follow-up.
export const CORPUS = [
  // Chai
  { skill: 'Making chai', a: 'I boil water with ginger, add tea leaves andaz se and let it boil until the colour looks right.', expect: ['vague_quantity', 'sensory'] },
  { skill: 'Making chai', a: 'Two cups of water, one cup of milk, two teaspoons of sugar.', none: true },
  { skill: 'Making chai', a: 'You just know when it is strong enough, it comes with practice.', expect: ['just_know'] },
  { skill: 'Making chai', a: 'In winter I add more ginger and some cardamom.', expect: ['condition'] },
  { skill: 'Making chai', a: 'I feel like everyone likes it sweet.', none: true },
  // Dosa batter
  { skill: 'Dosa batter', a: 'Soak 3 cups rice and 1 cup urad dal for 6 hours.', none: true },
  { skill: 'Dosa batter', a: 'Grind it till it feels smooth, not grainy, then add a pinch of salt.', expect: ['sensory', 'vague_quantity'] },
  { skill: 'Dosa batter', a: 'Ferment overnight, usually 8 to 12 hours depending on the weather.', expect: ['condition', 'hedge'] },
  { skill: 'Dosa batter', a: 'When it smells slightly sour and has risen, it is ready.', expect: ['sensory'] },
  // Bike repair
  { skill: 'Fixing a bike chain', a: 'Loosen the rear wheel nuts with a 15 mm spanner.', none: true },
  { skill: 'Fixing a bike chain', a: 'Tighten it a bit, then listen, if it sounds rough it is too tight.', expect: ['vague_quantity', 'sensory'] },
  { skill: 'Fixing a bike chain', a: 'I can tell by the sound when the gear is slipping.', expect: ['just_know', 'sensory'] },
  // Pottery
  { skill: 'Centering clay', a: 'Wet your hands and press down with your palms, the clay should feel even.', expect: ['sensory'] },
  { skill: 'Centering clay', a: 'Use about 1 kg of clay for a small bowl.', none: true },
  { skill: 'Centering clay', a: 'It depends on how wet the clay is.', expect: ['condition'] },
  // Tabla tuning
  { skill: 'Tuning a tabla', a: 'Tap the gajra with the hammer by ear until it matches the note.', expect: ['just_know', 'sensory'] },
  { skill: 'Tuning a tabla', a: 'Hit it lightly, not too hard.', expect: ['vague_quantity'] },
  // Farming
  { skill: 'Sowing wheat', a: 'Sow when the soil is moist enough, after the first rain.', expect: ['vague_quantity', 'condition'] },
  { skill: 'Sowing wheat', a: 'Use 40 kg of seed per acre, 20 cm between rows.', none: true },
  { skill: 'Sowing wheat', a: 'Thoda sa urea after three weeks, zyada nahi.', expect: ['vague_quantity'] },
  // Hinglish / edge
  { skill: 'Making chai', a: 'Bas jab tak rang na aa jaye, tab tak ubalo.', expect: [] , any: true },
  { skill: 'Making chai', a: 'ok', none: true },
  { skill: 'Making chai', a: 'Yes.', none: true },
];
