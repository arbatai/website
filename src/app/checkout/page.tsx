import "./checkout.css";

import NavBar from "@/components/NavBar";

import CheckoutClient from "./CheckoutClient";

export default function CheckoutPage() {
  return (
    <>
      <NavBar />
      <main className="co">
        <div className="co__wrap">
          <h1 className="co__title">Checkout</h1>
          <p className="co__subtitle">
            Your basket is saved locally, so you can refresh or come back later without losing it.
          </p>
          <CheckoutClient />
        </div>
      </main>
    </>
  );
}

