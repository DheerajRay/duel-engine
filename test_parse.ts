import { CARD_DB } from './src/constants';
const fusions = Object.values(CARD_DB).filter(c => c.isFusion);
console.log(fusions.map(c => `${c.name}: ${c.fusionMaterials?.join(', ')}`));
