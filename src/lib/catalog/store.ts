import "server-only";

import { turso } from "@/lib/turso/db";

import type { CatalogData, Category, Product } from "./types";

function rowString(v: unknown): string {
  if (typeof v === "string") return v;
  if (v === null || v === undefined) return "";
  return String(v);
}

export async function readCatalog(): Promise<CatalogData> {
  const db = await turso();

  const categoriesRes = await db.execute(
    "SELECT id, name, created_at AS createdAt FROM categories ORDER BY name COLLATE NOCASE ASC;"
  );
  const productsRes = await db.execute(
    `
      SELECT
        id,
        category_id AS categoryId,
        name,
        description,
        price_label AS priceLabel,
        image_url AS imageUrl,
        image_alt AS imageAlt,
        badge_text AS badgeText,
        badge_variant AS badgeVariant,
        created_at AS createdAt
      FROM products
      ORDER BY created_at DESC;
    `
  );

  const categories: Category[] = categoriesRes.rows.map((r) => ({
    id: rowString(r.id),
    name: rowString(r.name),
    createdAt: rowString(r.createdAt),
  }));

  const products: Product[] = productsRes.rows.map((r) => {
    const badgeText = r.badgeText === null || r.badgeText === undefined ? undefined : rowString(r.badgeText);
    const badgeVariant =
      r.badgeVariant === null || r.badgeVariant === undefined ? undefined : (rowString(r.badgeVariant) as Product["badgeVariant"]);
    return {
      id: rowString(r.id),
      categoryId: rowString(r.categoryId),
      name: rowString(r.name),
      description: rowString(r.description),
      priceLabel: rowString(r.priceLabel),
      imageUrl: rowString(r.imageUrl),
      imageAlt: rowString(r.imageAlt),
      badgeText,
      badgeVariant,
      createdAt: rowString(r.createdAt),
    };
  });

  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    categories,
    products,
  };
}

