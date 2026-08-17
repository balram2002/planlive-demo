/**
 * Product attribute presets — the "what else does a buyer need to know?"
 * layer, chosen by product type. Client-safe: no server imports.
 */

export type AttributeField = {
  key: string;
  label: string;
  kind: "chips" | "text" | "number";
  options?: string[];
  multi?: boolean;
  unit?: string;
  placeholder?: string;
  swatches?: boolean;
};

export type ProductTypePreset = {
  key: string;
  label: string;
  emoji: string;
  fields: AttributeField[];
};

export const COLOR_SWATCHES: Record<string, string> = {
  Black: "#111827",
  White: "#f8fafc",
  Grey: "#9ca3af",
  Beige: "#e7d8c1",
  Brown: "#78503c",
  Red: "#dc2626",
  Maroon: "#7f1d1d",
  Pink: "#ec4899",
  Orange: "#f97316",
  Yellow: "#eab308",
  Green: "#16a34a",
  Olive: "#4d7c0f",
  Teal: "#0d9488",
  Blue: "#2563eb",
  Navy: "#1e3a8a",
  Purple: "#7c3aed",
  Gold: "#d4af37",
  Silver: "#c0c0c0",
  Multicolour: "#a855f7",
};

const COLORS = Object.keys(COLOR_SWATCHES);

const colorField: AttributeField = {
  key: "color",
  label: "Colour",
  kind: "chips",
  options: COLORS,
  multi: true,
  swatches: true,
};

const APPAREL_SIZES = ["XS", "S", "M", "L", "XL", "XXL", "3XL", "Free size"];
const SHOE_SIZES = ["5", "6", "7", "8", "9", "10", "11", "12"];

export const PRODUCT_TYPES: ProductTypePreset[] = [
  {
    key: "clothing",
    label: "Clothing",
    emoji: "👕",
    fields: [
      { key: "size", label: "Size", kind: "chips", options: APPAREL_SIZES, multi: true },
      colorField,
      {
        key: "fabric",
        label: "Fabric",
        kind: "chips",
        options: ["Cotton", "Linen", "Silk", "Wool", "Denim", "Rayon", "Polyester", "Blend"],
      },
      { key: "fit", label: "Fit", kind: "chips", options: ["Slim", "Regular", "Relaxed", "Oversized"] },
      {
        key: "occasion",
        label: "Occasion",
        kind: "chips",
        options: ["Casual", "Formal", "Party", "Festive", "Sports"],
      },
    ],
  },
  {
    key: "footwear",
    label: "Footwear",
    emoji: "👟",
    fields: [
      { key: "size", label: "Size (UK)", kind: "chips", options: SHOE_SIZES, multi: true },
      colorField,
      {
        key: "material",
        label: "Material",
        kind: "chips",
        options: ["Leather", "Suede", "Canvas", "Mesh", "Synthetic", "Rubber"],
      },
      {
        key: "closure",
        label: "Closure",
        kind: "chips",
        options: ["Lace-up", "Slip-on", "Velcro", "Buckle", "Zip"],
      },
    ],
  },
  {
    key: "electronics",
    label: "Electronics",
    emoji: "🎧",
    fields: [
      { key: "brand", label: "Brand", kind: "text", placeholder: "e.g. Samsung" },
      { key: "model", label: "Model", kind: "text", placeholder: "e.g. Galaxy S24" },
      {
        key: "storage",
        label: "Storage",
        kind: "chips",
        options: ["32 GB", "64 GB", "128 GB", "256 GB", "512 GB", "1 TB"],
      },
      { key: "ram", label: "RAM", kind: "chips", options: ["4 GB", "6 GB", "8 GB", "12 GB", "16 GB"] },
      colorField,
      {
        key: "warranty",
        label: "Warranty",
        kind: "chips",
        options: ["No warranty", "3 months", "6 months", "1 year", "2 years"],
      },
      {
        key: "condition",
        label: "Condition",
        kind: "chips",
        options: ["Brand new", "Like new", "Refurbished", "Used - good", "Used - fair"],
      },
    ],
  },
  {
    key: "beauty",
    label: "Beauty",
    emoji: "💄",
    fields: [
      { key: "brand", label: "Brand", kind: "text", placeholder: "e.g. Lakmé" },
      { key: "shade", label: "Shade", kind: "text", placeholder: "e.g. Rose Nude" },
      { key: "volume", label: "Net quantity", kind: "number", unit: "ml", placeholder: "50" },
      {
        key: "skinType",
        label: "Suited to",
        kind: "chips",
        options: ["All skin", "Oily", "Dry", "Combination", "Sensitive"],
        multi: true,
      },
      { key: "expiry", label: "Best before", kind: "text", placeholder: "e.g. Dec 2027" },
    ],
  },
  {
    key: "jewellery",
    label: "Jewellery",
    emoji: "💍",
    fields: [
      {
        key: "material",
        label: "Material",
        kind: "chips",
        options: [
          "Gold plated",
          "Silver",
          "Sterling silver",
          "Brass",
          "Oxidised",
          "Artificial",
          "Kundan",
          "Pearl",
        ],
      },
      colorField,
      { key: "size", label: "Size", kind: "text", placeholder: "e.g. adjustable / 16 cm" },
      { key: "occasion", label: "Occasion", kind: "chips", options: ["Daily", "Party", "Wedding", "Festive"] },
    ],
  },
  {
    key: "home",
    label: "Home & kitchen",
    emoji: "🏠",
    fields: [
      {
        key: "material",
        label: "Material",
        kind: "chips",
        options: ["Wood", "Steel", "Glass", "Ceramic", "Plastic", "Cotton", "Bamboo"],
      },
      colorField,
      { key: "dimensions", label: "Size", kind: "text", placeholder: "e.g. 30 × 20 cm" },
      { key: "pieces", label: "Pieces in set", kind: "number", placeholder: "1" },
    ],
  },
  {
    key: "collectibles",
    label: "Collectibles",
    emoji: "🎴",
    fields: [
      { key: "brand", label: "Brand / franchise", kind: "text", placeholder: "e.g. Pokémon" },
      {
        key: "condition",
        label: "Condition",
        kind: "chips",
        options: ["Mint", "Near mint", "Good", "Played", "Damaged"],
      },
      { key: "year", label: "Year", kind: "number", placeholder: "2024" },
      { key: "grading", label: "Grading", kind: "text", placeholder: "e.g. PSA 9" },
    ],
  },
  {
    key: "other",
    label: "Something else",
    emoji: "🏷️",
    fields: [colorField],
  },
];

export function findPreset(key: string | null | undefined): ProductTypePreset | null {
  if (!key) return null;
  return PRODUCT_TYPES.find((t) => t.key === key) ?? null;
}

export type ProductAttribute = { label: string; value: string };

const MAX_ATTRIBUTES = 24;
const MAX_LEN = 60;

export function parseAttributes(json: string | null | undefined): ProductAttribute[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((a): a is ProductAttribute => typeof a?.label === "string" && typeof a?.value === "string")
      .map((a) => ({ label: a.label.slice(0, MAX_LEN), value: a.value.slice(0, MAX_LEN) }))
      .filter((a) => a.label.trim() && a.value.trim())
      .slice(0, MAX_ATTRIBUTES);
  } catch {
    return [];
  }
}

export function serializeAttributes(attributes: ProductAttribute[]): string | null {
  const clean = attributes
    .map((a) => ({ label: a.label.trim().slice(0, MAX_LEN), value: a.value.trim().slice(0, MAX_LEN) }))
    .filter((a) => a.label && a.value)
    .slice(0, MAX_ATTRIBUTES);
  return clean.length > 0 ? JSON.stringify(clean) : null;
}

const HEADLINE_ORDER = ["size", "colour", "color", "shade", "storage", "material"];

export function headlineAttributes(attributes: ProductAttribute[], limit = 2): ProductAttribute[] {
  const score = (a: ProductAttribute) => {
    const i = HEADLINE_ORDER.indexOf(a.label.trim().toLowerCase());
    return i === -1 ? HEADLINE_ORDER.length : i;
  };
  return [...attributes].sort((a, b) => score(a) - score(b)).slice(0, limit);
}

export function swatchFor(value: string): string | null {
  const key = Object.keys(COLOR_SWATCHES).find((c) => c.toLowerCase() === value.trim().toLowerCase());
  return key ? COLOR_SWATCHES[key] : null;
}
