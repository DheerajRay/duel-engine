import Papa from 'papaparse';
import { Card } from '../types';
import csvData from '../resource/original_yugioh_cards.csv?raw';

export const LOCAL_CARD_DB: Record<string, Card> = {};

const parsed = Papa.parse(csvData, {
  header: true,
  skipEmptyLines: true,
});

parsed.data.forEach((row: any) => {
  if (!row['Card Name']) return;
  
  const id = row['Card Name'].toLowerCase().replace(/[^a-z0-9]+/g, '-');
  
  let type: 'Monster' | 'Spell' | 'Trap' = 'Monster';
  if (row['Attribute'] === 'SPELL') {
    type = 'Spell';
  } else if (row['Attribute'] === 'TRAP') {
    type = 'Trap';
  } else {
    type = 'Monster';
  }

  const card: Card = {
    id,
    name: row['Card Name'],
    type,
    description: row['Lore / Effect / Description'] || '',
  };

  if (type === 'Monster') {
    card.attribute = row['Attribute'];
    card.level = parseInt(row['Level']) || 0;
    card.atk = row['ATK'] === '?' ? 0 : parseInt(row['ATK']) || 0;
    card.def = row['DEF'] === '?' ? 0 : parseInt(row['DEF']) || 0;
    
    if (row['Type'] && row['Type'].includes('Fusion')) {
      card.isFusion = true;
      const condition = row['Summoning Condition'] || row['Lore / Effect / Description'] || '';
      // Simple parsing: split by '+' and clean up quotes
      card.fusionMaterials = condition
        .split('+')
        .map((m: string) => m.replace(/"/g, '').trim())
        .filter(Boolean);
    }
  } else {
    card.subType = row['Spell/Trap Property'] as any;
  }

  LOCAL_CARD_DB[id] = card;
});
