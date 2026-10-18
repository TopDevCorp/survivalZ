export interface CraftingRecipe {
  id: string;
  name: string;
  description: string;
  ingredients: { itemId: string; count: number }[];
  requiresCampfire?: boolean;
  requiresSharpTool?: boolean;
  outputItemId: string;
  outputCount: number;
  placesCampfireInWorld?: boolean;
}

export const CRAFTING_RECIPES: CraftingRecipe[] = [
  {
    id: 'tear_shirt_rags',
    name: 'Tear Work Shirt into Rags',
    description: 'Shred a cotton work shirt into 2 sterile-ish cloth rags to stop bleeding.',
    ingredients: [{ itemId: 'shirt_work', count: 1 }],
    outputItemId: 'rag',
    outputCount: 2,
  },
  {
    id: 'tear_jacket_rags',
    name: 'Tear Track Jacket into Rags',
    description: 'Cut up a worn athletic jacket into 2 absorbent cloth strips.',
    ingredients: [{ itemId: 'jacket_track', count: 1 }],
    outputItemId: 'rag',
    outputCount: 2,
  },
  {
    id: 'craft_splint',
    name: 'Bind Improvised Splint',
    description: 'Lash wooden sticks together with cloth rags to stabilize fractures and sprains.',
    ingredients: [
      { itemId: 'wooden_sticks', count: 1 },
      { itemId: 'rag', count: 1 },
    ],
    outputItemId: 'splint',
    outputCount: 1,
  },
  {
    id: 'craft_campfire',
    name: 'Build & Ignite Campfire',
    description: 'Combine dry firewood sticks and birch bark tinder to light a warming fire in front of you.',
    ingredients: [
      { itemId: 'wooden_sticks', count: 1 },
      { itemId: 'birch_bark', count: 1 },
    ],
    outputItemId: 'campfire_kit',
    outputCount: 1,
    placesCampfireInWorld: true,
  },
  {
    id: 'cook_meat',
    name: 'Roast Raw Venison over Fire',
    description: 'Sear raw game meat over an active campfire (must stand within 6m of burning fire).',
    ingredients: [{ itemId: 'meat_raw', count: 1 }],
    requiresCampfire: true,
    outputItemId: 'meat_cooked',
    outputCount: 1,
  },
];
