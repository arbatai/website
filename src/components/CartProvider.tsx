"use client";

import type { ReactNode } from "react";
import { useSyncExternalStore } from "react";

type CartLine = {
  productId: string;
  name: string;
  priceLabel: string;
  imageUrl: string;
  imageAlt: string;
  quantity: number;
};

type CartData = {
  version: 1;
  updatedAt: string;
  lines: CartLine[];
};

const STORAGE_KEY = "arbatai_cart_v1";
const MAX_QTY = 99;

const listeners = new Set<() => void>();
let storageListenerAttached = false;

let cachedRaw: string | null = null;
let cachedCart: CartData | null = null;

function emptyCart(): CartData {
  return { version: 1, updatedAt: new Date(0).toISOString(), lines: [] };
}

function clampQty(input: number): number {
  return Math.max(0, Math.min(MAX_QTY, Math.floor(input)));
}

function sanitizeCart(input: unknown): CartData {
  if (!input || typeof input !== "object") return emptyCart();
  const obj = input as Partial<CartData>;
  if (obj.version !== 1) return emptyCart();
  if (!Array.isArray(obj.lines)) return emptyCart();

  const updatedAt = typeof obj.updatedAt === "string" ? obj.updatedAt : new Date(0).toISOString();
  const lines: CartLine[] = [];

  for (const raw of obj.lines) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Partial<CartLine>;
    if (!r.productId || typeof r.productId !== "string") continue;
    if (!r.name || typeof r.name !== "string") continue;
    if (!r.priceLabel || typeof r.priceLabel !== "string") continue;
    if (!r.imageUrl || typeof r.imageUrl !== "string") continue;
    const imageAlt = typeof r.imageAlt === "string" && r.imageAlt.trim() ? r.imageAlt : r.name;
    const quantityRaw = typeof r.quantity === "number" ? r.quantity : 1;
    const quantity = Math.max(1, Math.min(MAX_QTY, Math.floor(quantityRaw)));
    lines.push({
      productId: r.productId,
      name: r.name,
      priceLabel: r.priceLabel,
      imageUrl: r.imageUrl,
      imageAlt,
      quantity,
    });
  }

  return { version: 1, updatedAt, lines };
}

function readCart(): CartData {
  if (typeof window === "undefined") return emptyCart();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyCart();
    if (raw === cachedRaw && cachedCart) return cachedCart;
    const parsed = sanitizeCart(JSON.parse(raw));
    cachedRaw = raw;
    cachedCart = parsed;
    return parsed;
  } catch {
    return emptyCart();
  }
}

function writeCart(cart: CartData): void {
  if (typeof window === "undefined") return;
  try {
    const raw = JSON.stringify(cart);
    localStorage.setItem(STORAGE_KEY, raw);
    cachedRaw = raw;
    cachedCart = cart;
  } catch {
    // Ignore storage quota / privacy mode errors.
  }
}

function emit(): void {
  for (const l of listeners) l();
}

function ensureStorageListener(): void {
  if (storageListenerAttached) return;
  if (typeof window === "undefined") return;
  storageListenerAttached = true;
  window.addEventListener("storage", (ev) => {
    if (ev.key !== STORAGE_KEY) return;
    emit();
  });
}

function subscribe(listener: () => void): () => void {
  ensureStorageListener();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): CartData {
  return readCart();
}

function getServerSnapshot(): CartData {
  return emptyCart();
}

function updateCart(mutator: (cart: CartData) => CartData): void {
  const current = readCart();
  const next = mutator(current);
  writeCart(next);
  emit();
}

function addToCart(
  product: { id: string; name: string; priceLabel: string; imageUrl: string; imageAlt?: string },
  quantity = 1
): void {
  const q = clampQty(quantity);
  if (q <= 0) return;

  updateCart((cart) => {
    const nextLines: CartLine[] = [];
    let merged = false;

    for (const l of cart.lines) {
      if (l.productId !== product.id) {
        nextLines.push(l);
        continue;
      }
      merged = true;
      nextLines.push({
        ...l,
        name: product.name,
        priceLabel: product.priceLabel,
        imageUrl: product.imageUrl,
        imageAlt: product.imageAlt?.trim() ? product.imageAlt : product.name,
        quantity: Math.min(MAX_QTY, l.quantity + q),
      });
    }

    if (!merged) {
      nextLines.push({
        productId: product.id,
        name: product.name,
        priceLabel: product.priceLabel,
        imageUrl: product.imageUrl,
        imageAlt: product.imageAlt?.trim() ? product.imageAlt : product.name,
        quantity: Math.max(1, q),
      });
    }

    return { version: 1, updatedAt: new Date().toISOString(), lines: nextLines };
  });
}

function removeFromCart(productId: string): void {
  updateCart((cart) => {
    const nextLines = cart.lines.filter((l) => l.productId !== productId);
    return { version: 1, updatedAt: new Date().toISOString(), lines: nextLines };
  });
}

function setCartQuantity(productId: string, quantity: number): void {
  const q = clampQty(quantity);
  updateCart((cart) => {
    const nextLines: CartLine[] = [];
    for (const l of cart.lines) {
      if (l.productId !== productId) {
        nextLines.push(l);
        continue;
      }
      if (q <= 0) continue;
      nextLines.push({ ...l, quantity: Math.max(1, q) });
    }
    return { version: 1, updatedAt: new Date().toISOString(), lines: nextLines };
  });
}

function clearCart(): void {
  updateCart(() => ({ version: 1, updatedAt: new Date().toISOString(), lines: [] }));
}

export function useCart(): {
  lines: CartLine[];
  totalQuantity: number;
  uniqueCount: number;
  add: typeof addToCart;
  remove: typeof removeFromCart;
  setQuantity: typeof setCartQuantity;
  clear: typeof clearCart;
} {
  const cart = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const totalQuantity = cart.lines.reduce((acc, l) => acc + l.quantity, 0);
  return {
    lines: cart.lines,
    totalQuantity,
    uniqueCount: cart.lines.length,
    add: addToCart,
    remove: removeFromCart,
    setQuantity: setCartQuantity,
    clear: clearCart,
  };
}

export default function CartProvider({ children }: { children: ReactNode }) {
  return children;
}

