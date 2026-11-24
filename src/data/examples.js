// Example "skills" from very different fields. Forms show one whole set at a time, so the
// placeholders always tell a consistent story, and each visit hints at a different domain.
export const EXAMPLES = [
  {
    skill: 'Handling the payment-queue alert at 3 a.m.',
    about: 'What our on-call engineers do when the queue backs up',
    name: 'Ravi', relation: 'senior SRE', context: 'eight years running the payments platform',
  },
  {
    skill: 'Diagnosing a slipping bike chain',
    about: 'How a mechanic hears what is wrong before taking anything apart',
    name: 'Raju', relation: 'mechanic', context: 'runs a repair shop in Pune, 20 years',
  },
  {
    skill: 'Training an image model that does not overfit',
    about: 'The instincts our ML lead uses when the loss curve looks wrong',
    name: 'Ananya', relation: 'ML lead', context: 'has shipped vision models for six years',
  },
  {
    skill: 'Centering clay on the wheel',
    about: 'The first thing every potter learns, and the hardest to explain',
    name: 'Meera', relation: 'potter', context: 'teaches weekend pottery classes',
  },
  {
    skill: 'Fermenting dosa batter',
    about: 'Batter for crisp dosas, made every week for forty years',
    name: 'Paati', relation: 'grandmother', context: 'cooks in Chennai, 50 years',
  },
  {
    skill: 'Migrating the legacy billing database',
    about: 'The order of steps only one person on the team really knows',
    name: 'Suresh', relation: 'staff engineer', context: 'wrote the original billing system',
  },
  {
    skill: 'Knowing when to sow wheat',
    about: 'Reading the soil and the weather before the first sowing',
    name: 'Harjit', relation: 'farmer', context: 'farms 12 acres in Punjab',
  },
];

export function pickExample() {
  return EXAMPLES[Math.floor(Math.random() * EXAMPLES.length)];
}
