import "server-only";

import crypto from "node:crypto";

import { turso } from "@/lib/turso/db";

import type { Category, Product, ProductBadgeVariant } from "./types";

function nowIso(): string {
  return new Date().toISOString();
}

function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeName(s: string): string {
  return s.trim().replace(/\s+/g, " ");
}

function isUniqueConstraintError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.toLowerCase().includes("unique constraint failed");
}

function isPrimaryKeyConstraintError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.toLowerCase().includes("unique constraint failed") && msg.toLowerCase().includes(".id");
}

export async function createCategory(nameRaw: string): Promise<Category> {
  const name = normalizeName(nameRaw);
  if (!name) throw new Error("Category name is required.");
  if (name.length > 60) throw new Error("Category name is too long (max 60 chars).");

  const db = await turso();
  const createdAt = nowIso();

  const baseId = slugify(name) || crypto.randomUUID();

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const id =
      attempt === 0 ? baseId : `${baseId}-${crypto.randomBytes(2).toString("hex")}`;
    try {
      await db.execute({
        sql: "INSERT INTO categories (id, name, created_at) VALUES (?, ?, ?);",
        args: [id, name, createdAt],
      });
      return { id, name, createdAt };
    } catch (err) {
      if (isUniqueConstraintError(err)) {
        // Name unique constraint is case-insensitive, so treat as a user-friendly error.
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.toLowerCase().includes("categories.name")) {
          throw new Error("Category already exists.");
        }
      }
      if (isPrimaryKeyConstraintError(err)) continue;
      throw err;
    }
  }

  throw new Error("Failed to create category (id collision).");
}

export async function deleteCategory(categoryId: string): Promise<void> {
  const id = categoryId.trim();
  if (!id) return;
  const db = await turso();

  // Explicitly delete products as a safety net even though we have ON DELETE CASCADE.
  await db.execute({ sql: "DELETE FROM products WHERE category_id = ?;", args: [id] });
  await db.execute({ sql: "DELETE FROM categories WHERE id = ?;", args: [id] });
}

export type CreateProductInput = {
  categoryId: string;
  name: string;
  description: string;
  priceLabel: string;
  imageUrl: string;
  imageAlt: string;
  badgeText?: string;
  badgeVariant?: ProductBadgeVariant;
};

export async function createProduct(input: CreateProductInput): Promise<Product> {
  const categoryId = input.categoryId.trim();
  const name = normalizeName(input.name);
  const description = input.description.trim();
  const priceLabel = input.priceLabel.trim();
  const imageUrl = input.imageUrl.trim();
  const imageAlt = input.imageAlt.trim() || name;
  const badgeText = input.badgeText?.trim() || undefined;
  const badgeVariant = input.badgeVariant;

  if (!categoryId) throw new Error("Category is required.");
  if (!name) throw new Error("Product name is required.");
  if (name.length > 80) throw new Error("Product name is too long (max 80 chars).");
  if (!description) throw new Error("Product description is required.");
  if (description.length > 200) throw new Error("Product description is too long (max 200 chars).");
  if (!priceLabel) throw new Error("Price is required.");
  if (priceLabel.length > 20) throw new Error("Price is too long.");
  if (!imageUrl) throw new Error("Image URL is required.");
  if (imageUrl.length > 2000) throw new Error("Image URL is too long.");

  let parsedUrl: URL | undefined;
  try {
    parsedUrl = new URL(imageUrl);
  } catch {
    throw new Error("Image URL is invalid.");
  }
  if (parsedUrl.protocol !== "https:") throw new Error("Image URL must be https.");

  if (badgeVariant && badgeVariant !== "default" && badgeVariant !== "hot") {
    throw new Error("Badge variant is invalid.");
  }

  const db = await turso();

  const categoryExists = await db.execute({
    sql: "SELECT 1 FROM categories WHERE id = ? LIMIT 1;",
    args: [categoryId],
  });
  if (categoryExists.rows.length === 0) throw new Error("Category does not exist.");

  const createdAt = nowIso();
  const baseId = slugify(name) || crypto.randomUUID();

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const id =
      attempt === 0 ? baseId : `${baseId}-${crypto.randomBytes(2).toString("hex")}`;
    try {
      await db.execute({
        sql: `
          INSERT INTO products (
            id, category_id, name, description, price_label,
            image_url, image_alt, badge_text, badge_variant, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
        `,
        args: [
          id,
          categoryId,
          name,
          description,
          priceLabel,
          imageUrl,
          imageAlt,
          badgeText ?? null,
          badgeVariant ?? null,
          createdAt,
        ],
      });

      return {
        id,
        categoryId,
        name,
        description,
        priceLabel,
        imageUrl,
        imageAlt,
        badgeText,
        badgeVariant,
        createdAt,
      };
    } catch (err) {
      if (isPrimaryKeyConstraintError(err)) continue;
      throw err;
    }
  }

  throw new Error("Failed to create product (id collision).");
}

export async function deleteProduct(productId: string): Promise<void> {
  const id = productId.trim();
  if (!id) return;
  const db = await turso();
  await db.execute({ sql: "DELETE FROM products WHERE id = ?;", args: [id] });
}

