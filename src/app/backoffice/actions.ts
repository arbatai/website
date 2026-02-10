"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { put } from "@vercel/blob";

import {
  clearBackofficeSessionCookie,
  isBackofficeAuthed,
  setBackofficeSessionCookie,
  verifyBackofficePassword,
} from "@/lib/backoffice/auth";
import {
  addProductImages,
  createCategory,
  createProduct,
  deleteCategory,
  deleteProduct,
} from "@/lib/catalog/mutate";
import { readCatalog } from "@/lib/catalog/store";
import type { ProductBadgeVariant } from "@/lib/catalog/types";

async function requireAuth(): Promise<void> {
  if (!(await isBackofficeAuthed())) redirect("/backoffice?error=auth-required");
}

function redirectWithError(message: string): never {
  redirect(`/backoffice?error=${encodeURIComponent(message)}`);
}

function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function safeFilename(original: string): string {
  const name = original.trim();
  const dot = name.lastIndexOf(".");
  const base = dot === -1 ? name : name.slice(0, dot);
  const ext = dot === -1 ? "" : name.slice(dot + 1);
  const safeBase = slugify(base) || "image";
  const safeExt = slugify(ext);
  return safeExt ? `${safeBase}.${safeExt}` : safeBase;
}

function getFiles(formData: FormData, name: string): File[] {
  const entries = formData.getAll(name);
  const files: File[] = [];
  for (const v of entries) {
    if (typeof v === "string") continue;
    // In server actions, file inputs arrive as `File`.
    if (v instanceof File && v.size > 0) files.push(v);
  }
  return files;
}

async function uploadImagesToBlob(productName: string, files: File[]): Promise<Array<{ url: string }>> {
  const prefix = slugify(productName) || "product";
  const folder = `products/${prefix}`;

  // Keep this conservative. If you need more, we can switch to client uploads.
  const MAX_FILES = 8;
  const MAX_BYTES = 10 * 1024 * 1024; // 10MB each

  if (files.length === 0) throw new Error("Please upload at least one image.");
  if (files.length > MAX_FILES) throw new Error(`Too many images (max ${MAX_FILES}).`);

  for (const f of files) {
    if (!f.type.startsWith("image/")) throw new Error("Only image uploads are allowed.");
    if (f.size > MAX_BYTES) throw new Error("Image is too large (max 10MB).");
  }

  const results: Array<{ url: string }> = [];
  for (const f of files) {
    const pathname = `${folder}/${safeFilename(f.name)}`;
    const res = await put(pathname, f, {
      access: "public",
      addRandomSuffix: true,
      contentType: f.type || undefined,
    });
    results.push({ url: res.url });
  }
  return results;
}

export async function loginAction(formData: FormData): Promise<void> {
  const password = String(formData.get("password") ?? "");
  if (!verifyBackofficePassword(password)) {
    redirectWithError("Invalid password.");
  }
  await setBackofficeSessionCookie();
  redirect("/backoffice");
}

export async function logoutAction(): Promise<void> {
  await clearBackofficeSessionCookie();
  redirect("/backoffice");
}

export async function createCategoryAction(formData: FormData): Promise<void> {
  await requireAuth();
  const name = String(formData.get("name") ?? "");

  try {
    await createCategory(name);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create category.";
    redirectWithError(message);
  }

  revalidatePath("/");
  revalidatePath("/backoffice");
  redirect("/backoffice");
}

export async function deleteCategoryAction(formData: FormData): Promise<void> {
  await requireAuth();
  const id = String(formData.get("id") ?? "");
  if (!id) redirectWithError("Missing category id.");

  await deleteCategory(id);
  revalidatePath("/");
  revalidatePath("/backoffice");
  redirect("/backoffice");
}

export async function createProductAction(formData: FormData): Promise<void> {
  await requireAuth();

  const categoryId = String(formData.get("categoryId") ?? "");
  const name = String(formData.get("name") ?? "");
  const description = String(formData.get("description") ?? "");
  const priceLabel = String(formData.get("priceLabel") ?? "");
  const imageAlt = String(formData.get("imageAlt") ?? "");
  const badgeText = String(formData.get("badgeText") ?? "");
  const badgeVariantRaw = String(formData.get("badgeVariant") ?? "");
  const badgeVariant =
    badgeVariantRaw === "" ? undefined : (badgeVariantRaw as ProductBadgeVariant);

  try {
    const files = getFiles(formData, "images");
    const uploads = await uploadImagesToBlob(name, files);

    const primaryAlt = imageAlt.trim() || name.trim();
    const product = await createProduct({
      categoryId,
      name,
      description,
      priceLabel,
      imageUrl: uploads[0]!.url,
      imageAlt: primaryAlt,
      badgeText: badgeText || undefined,
      badgeVariant,
    });

    const extra = uploads.slice(1).map((u, idx) => ({
      url: u.url,
      alt: imageAlt.trim() ? imageAlt.trim() : `${name.trim()} image ${idx + 2}`,
    }));
    if (extra.length > 0) {
      await addProductImages(product.id, extra);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create product.";
    redirectWithError(message);
  }

  revalidatePath("/");
  revalidatePath("/backoffice");
  redirect("/backoffice");
}

export async function deleteProductAction(formData: FormData): Promise<void> {
  await requireAuth();
  const id = String(formData.get("id") ?? "");
  if (!id) redirectWithError("Missing product id.");

  await deleteProduct(id);
  revalidatePath("/");
  revalidatePath("/backoffice");
  redirect("/backoffice");
}

export async function addProductImagesAction(formData: FormData): Promise<void> {
  await requireAuth();

  const productId = String(formData.get("productId") ?? "");
  const imageAlt = String(formData.get("imageAlt") ?? "");

  try {
    const catalog = await readCatalog();
    const product = catalog.products.find((p) => p.id === productId);
    if (!product) throw new Error("Product does not exist.");
    const name = product.name;

    const files = getFiles(formData, "images");
    const uploads = await uploadImagesToBlob(name, files);
    const extra = uploads.map((u, idx) => ({
      url: u.url,
      alt: imageAlt.trim() ? imageAlt.trim() : `${name.trim()} image ${idx + 1}`,
    }));
    await addProductImages(productId, extra);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to add images.";
    redirectWithError(message);
  }

  revalidatePath("/");
  revalidatePath("/backoffice");
  redirect("/backoffice");
}
