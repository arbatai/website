import "server-only";

import { turso } from "@/lib/turso/db";

import type { CatalogData, Category, Product, ProductImage } from "./types";

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
  const imagesRes = await db.execute(
    `
      SELECT
        id,
        product_id AS productId,
        url,
        alt,
        sort_order AS sortOrder,
        created_at AS createdAt
      FROM product_images
      ORDER BY product_id, sort_order ASC, created_at ASC;
    `
  );

  const categories: Category[] = categoriesRes.rows.map((r) => ({
    id: rowString(r.id),
    name: rowString(r.name),
    createdAt: rowString(r.createdAt),
  }));

  const imagesByProductId = new Map<string, ProductImage[]>();
  for (const r of imagesRes.rows) {
    const productId = rowString(r.productId);
    if (!productId) continue;
    const img: ProductImage = {
      id: rowString(r.id),
      productId,
      url: rowString(r.url),
      alt: rowString(r.alt),
      sortOrder: Number(r.sortOrder ?? 0),
      createdAt: rowString(r.createdAt),
    };
    const arr = imagesByProductId.get(productId);
    if (arr) arr.push(img);
    else imagesByProductId.set(productId, [img]);
  }

  const products: Product[] = productsRes.rows.map((r) => {
    const badgeText = r.badgeText === null || r.badgeText === undefined ? undefined : rowString(r.badgeText);
    const badgeVariant =
      r.badgeVariant === null || r.badgeVariant === undefined ? undefined : (rowString(r.badgeVariant) as Product["badgeVariant"]);
    const id = rowString(r.id);
    const imageUrl = rowString(r.imageUrl);
    const imageAlt = rowString(r.imageAlt);
    const primary: ProductImage = {
      id: `primary:${id}`,
      productId: id,
      url: imageUrl,
      alt: imageAlt,
      sortOrder: 0,
      createdAt: rowString(r.createdAt),
    };
    const extra = imagesByProductId.get(id) ?? [];
    const images = [primary, ...extra].filter((img) => Boolean(img.url));

    return {
      id: rowString(r.id),
      categoryId: rowString(r.categoryId),
      name: rowString(r.name),
      description: rowString(r.description),
      priceLabel: rowString(r.priceLabel),
      imageUrl,
      imageAlt,
      images,
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
