"use client";

/* eslint-disable @next/next/no-img-element */

import { useState } from "react";
import Link from "next/link";

import { useCart } from "@/components/CartProvider";

type CheckoutDetails = {
  email: string;
  fullName: string;
  address1: string;
  city: string;
  postcode: string;
};

function currencyFromLabel(label: string): string {
  if (label.includes("£")) return "GBP";
  if (label.includes("€")) return "EUR";
  if (label.includes("$")) return "USD";
  return "GBP";
}

function parsePrice(label: string): number | null {
  const cleaned = label.replace(/,/g, "");
  const m = cleaned.match(/-?\d+(\.\d+)?/);
  if (!m) return null;
  const v = Number(m[0]);
  return Number.isFinite(v) ? v : null;
}

export default function CheckoutClient() {
  const { lines, totalQuantity, setQuantity, remove, clear } = useCart();
  const [details, setDetails] = useState<CheckoutDetails>({
    email: "",
    fullName: "",
    address1: "",
    city: "",
    postcode: "",
  });
  const [savedAt, setSavedAt] = useState<string>("");

  const totals = (() => {
    if (lines.length === 0) return { subtotalLabel: "£0.00", canCompute: true };
    const currency = currencyFromLabel(lines[0]?.priceLabel ?? "£");
    let subtotal = 0;
    for (const l of lines) {
      const p = parsePrice(l.priceLabel);
      if (p === null) return { subtotalLabel: "—", canCompute: false };
      subtotal += p * l.quantity;
    }
    const fmt = new Intl.NumberFormat("en-GB", { style: "currency", currency });
    return { subtotalLabel: fmt.format(subtotal), canCompute: true };
  })();

  if (lines.length === 0) {
    return (
      <div className="co__empty">
        <div className="co__name">Your basket is empty.</div>
        <div className="co__meta">
          Head back to the{" "}
          <Link href="/#shop" scroll>
            shop
          </Link>{" "}
          and add something comforting.
        </div>
      </div>
    );
  }

  return (
    <div className="co__grid">
      <section className="co__card">
        <h2>Basket</h2>
        <ul className="co__lines">
          {lines.map((l) => (
            <li className="co__line" key={l.productId}>
              <div className="co__thumb">
                <img src={l.imageUrl} alt={l.imageAlt || l.name} loading="lazy" decoding="async" />
              </div>
              <div>
                <div className="co__name">{l.name}</div>
                <div className="co__meta">
                  {l.priceLabel} · <strong>{l.quantity}</strong>{" "}
                  {l.quantity === 1 ? "item" : "items"}
                </div>
              </div>
              <div className="co__right">
                <div className="co__qty" aria-label={`Quantity controls for ${l.name}`}>
                  <button
                    className="co__qtybtn"
                    type="button"
                    aria-label="Decrease quantity"
                    onClick={() => setQuantity(l.productId, l.quantity - 1)}
                  >
                    −
                  </button>
                  <span className="co__qtyval" aria-label={`Quantity ${l.quantity}`}>
                    {l.quantity}
                  </span>
                  <button
                    className="co__qtybtn"
                    type="button"
                    aria-label="Increase quantity"
                    onClick={() => setQuantity(l.productId, l.quantity + 1)}
                  >
                    +
                  </button>
                </div>
                <button className="co__remove" type="button" onClick={() => remove(l.productId)}>
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>

        <div className="co__divider" />

        <div className="co__btnrow">
          <button className="co__btn co__btn--ghost" type="button" onClick={clear}>
            Clear basket
          </button>
          <Link className="co__btn co__btn--ghost" href="/#shop" scroll>
            Keep shopping
          </Link>
        </div>
      </section>

      <aside className="co__card">
        <h2>Checkout</h2>

        <div className="co__summary">
          <div className="co__row">
            <span>Items</span>
            <strong>{totalQuantity}</strong>
          </div>
          <div className="co__row">
            <span>{totals.canCompute ? "Subtotal" : "Subtotal (est.)"}</span>
            <strong>{totals.subtotalLabel}</strong>
          </div>
          <div className="co__row">
            <span>Shipping</span>
            <strong>Free</strong>
          </div>
          <div className="co__row">
            <span>Total</span>
            <strong>{totals.subtotalLabel}</strong>
          </div>
          <div className="co__hint">
            Payment/order submission is not wired up yet.
          </div>
        </div>

        <form
          className="co__form"
          onSubmit={(e) => {
            e.preventDefault();
            setSavedAt(new Date().toLocaleString());
          }}
        >
          <div className="co__field">
            <label htmlFor="co-email">Email</label>
            <input
              id="co-email"
              type="email"
              value={details.email}
              onChange={(e) => setDetails((d) => ({ ...d, email: e.target.value }))}
              required
            />
          </div>
          <div className="co__field">
            <label htmlFor="co-name">Full name</label>
            <input
              id="co-name"
              value={details.fullName}
              onChange={(e) => setDetails((d) => ({ ...d, fullName: e.target.value }))}
              required
            />
          </div>
          <div className="co__field">
            <label htmlFor="co-address">Address</label>
            <input
              id="co-address"
              value={details.address1}
              onChange={(e) => setDetails((d) => ({ ...d, address1: e.target.value }))}
              required
            />
          </div>
          <div className="co__field">
            <label htmlFor="co-city">City</label>
            <input
              id="co-city"
              value={details.city}
              onChange={(e) => setDetails((d) => ({ ...d, city: e.target.value }))}
              required
            />
          </div>
          <div className="co__field">
            <label htmlFor="co-postcode">Postcode</label>
            <input
              id="co-postcode"
              value={details.postcode}
              onChange={(e) => setDetails((d) => ({ ...d, postcode: e.target.value }))}
              required
            />
          </div>

          <div className="co__btnrow">
            <button className="co__btn" type="submit">
              Save details (demo)
            </button>
          </div>

          {savedAt ? <div className="co__saved">Saved (demo): {savedAt}</div> : null}
        </form>
      </aside>
    </div>
  );
}
