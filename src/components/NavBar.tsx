"use client";

import Link from "next/link";

import { useCart } from "@/components/CartProvider";

export default function NavBar() {
  const { totalQuantity } = useCart();
  const basketLabel =
    totalQuantity === 0 ? "Basket" : `Basket (${totalQuantity} ${totalQuantity === 1 ? "item" : "items"})`;

  return (
    <nav aria-label="Primary">
      <Link className="logo" href="/">
        Arbatai.
      </Link>
      <div className="nav-links">
        <Link className="nav-item" href="/#shop">
          Shop
        </Link>
        <Link className="nav-item" href="/#roots">
          Our Roots
        </Link>
        <Link className="nav-item" href="/#shop">
          Bundles
        </Link>
        <Link className="cart-count" href="/checkout" aria-label={basketLabel}>
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M6 8h12l-1 13H7L6 8Z" />
            <path d="M9 8V6a3 3 0 0 1 6 0v2" />
          </svg>
          {totalQuantity > 0 ? (
            <span className="cart-badge" aria-hidden="true">
              {totalQuantity > 99 ? "99+" : totalQuantity}
            </span>
          ) : null}
        </Link>
      </div>
    </nav>
  );
}

