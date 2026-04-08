const OFF_BASE_URL = "https://world.openfoodfacts.org/api/v2";
const OFF_SEARCH_URL = "https://world.openfoodfacts.org/cgi/search.pl";

export interface OpenFoodFactsProduct {
  code: string;
  productName: string;
  brands?: string;
  caloriesPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
}

export interface OpenFoodFactsSearchResult extends OpenFoodFactsProduct {
  categories?: string[];
  isBranded: boolean;
}

function roundNutrition(value: number) {
  return Math.round(Number(value ?? 0));
}

function mapProduct(product: any, code?: string): OpenFoodFactsSearchResult {
  return {
    code: code ?? product.code ?? "",
    productName: product.product_name ?? "Unknown product",
    brands: product.brands ?? undefined,
    caloriesPer100g: roundNutrition(product.nutriments?.["energy-kcal_100g"] ?? 0),
    proteinPer100g: roundNutrition(product.nutriments?.proteins_100g ?? 0),
    carbsPer100g: roundNutrition(product.nutriments?.carbohydrates_100g ?? 0),
    fatPer100g: roundNutrition(product.nutriments?.fat_100g ?? 0),
    categories: Array.isArray(product.categories_tags) ? product.categories_tags : [],
    isBranded: Boolean(product.brands || product.brands_tags?.length),
  };
}

export async function fetchBarcodeProduct(barcode: string): Promise<OpenFoodFactsProduct | null> {
  if (!barcode.trim()) {
    return null;
  }

  const response = await fetch(`${OFF_BASE_URL}/product/${barcode}.json`);
  if (!response.ok) {
    throw new Error("Unable to load barcode product.");
  }

  const payload = await response.json();
  const product = payload.product;
  if (!product) {
    return null;
  }

  return mapProduct(product, payload.code);
}

export async function searchOpenFoodFactsProducts(query: string): Promise<OpenFoodFactsSearchResult[]> {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) {
    return [];
  }

  const response = await fetch(
    `${OFF_SEARCH_URL}?search_terms=${encodeURIComponent(trimmedQuery)}&search_simple=1&action=process&json=1&page_size=10&fields=code,product_name,brands,brands_tags,categories_tags,nutriments`
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Unable to search Open Food Facts (${response.status}). ${errorText || "Please try again."}`);
  }

  const payload = await response.json();
  const products = Array.isArray(payload.products) ? payload.products : [];

  return products
    .filter((product) => product?.product_name)
    .map((product) => mapProduct(product));
}
