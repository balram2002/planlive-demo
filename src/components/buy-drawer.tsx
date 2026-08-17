"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ProductThumb } from "@/components/product-thumb";
import { AttributeChips } from "@/components/products/attribute-chips";
import { formatPrice } from "@/lib/format";
import { COD_DELIVERY_FEE_PAISE, priceBreakdown } from "@/lib/pricing";
import { haptics } from "@/lib/haptics";
import { cn } from "@/lib/cn";
import type { ViewerProduct } from "./viewer-room";

export type BuyFlow = { product: ViewerProduct };

type Step = "address" | "payment" | "success";

const CONTACT_STORAGE_KEY = "livewab_demo_buyer_contact";

type Contact = {
  buyerName: string;
  buyerPhone: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  pincode: string;
};

const EMPTY_CONTACT: Contact = {
  buyerName: "",
  buyerPhone: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  state: "",
  pincode: "",
};

function loadContact(): Contact {
  try {
    const raw = localStorage.getItem(CONTACT_STORAGE_KEY);
    if (!raw) return EMPTY_CONTACT;
    return { ...EMPTY_CONTACT, ...JSON.parse(raw) };
  } catch {
    return EMPTY_CONTACT;
  }
}

/**
 * Checkout funnel: address + mobile number (no verification) → Cash on
 * Delivery confirm → success. No accounts, no online payment, no stock hold
 * — placing the order is the atomic stock decrement itself, so there's no
 * separate reservation step or countdown to show.
 */
export function BuyDrawer({
  flow,
  onClose,
  onStockChange,
}: {
  flow: BuyFlow | null;
  onClose: () => void;
  onStockChange?: (productId: string, availableStock: number) => void;
}) {
  const [step, setStep] = useState<Step>("address");
  const [contact, setContact] = useState<Contact>(EMPTY_CONTACT);
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [placedOrder, setPlacedOrder] = useState<{ amountInPaise: number } | null>(null);

  const flowKey = flow?.product.id ?? null;
  const [lastFlowKey, setLastFlowKey] = useState<string | null>(null);
  if (flowKey !== lastFlowKey) {
    setLastFlowKey(flowKey);
    if (flowKey) {
      setStep("address");
      setError(null);
      setPlacedOrder(null);
      setContact(loadContact());
    }
  }

  const totals = priceBreakdown(flow?.product.priceInPaise ?? 0);

  function update<K extends keyof Contact>(key: K, value: Contact[K]) {
    setContact((prev) => ({ ...prev, [key]: value }));
  }

  function validAddress(): string | null {
    if (contact.buyerName.trim().length < 2) return "Enter your name.";
    if (!/^\d{7,15}$/.test(contact.buyerPhone.trim())) return "Enter a valid mobile number.";
    if (!contact.addressLine1.trim()) return "Enter your address.";
    if (!contact.city.trim()) return "Enter your city.";
    if (!contact.state.trim()) return "Enter your state.";
    if (!/^\d{4,10}$/.test(contact.pincode.trim())) return "Enter a valid pincode.";
    return null;
  }

  async function placeOrder() {
    if (!flow) return;
    haptics.tap();
    const validationError = validAddress();
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    setPlacing(true);
    try {
      localStorage.setItem(CONTACT_STORAGE_KEY, JSON.stringify(contact));
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: flow.product.id,
          buyerName: contact.buyerName.trim(),
          buyerPhone: contact.buyerPhone.trim(),
          addressLine1: contact.addressLine1.trim(),
          addressLine2: contact.addressLine2.trim(),
          city: contact.city.trim(),
          state: contact.state.trim(),
          pincode: contact.pincode.trim(),
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "Couldn't place order.");
        return;
      }
      onStockChange?.(flow.product.id, body.availableStock);
      setPlacedOrder({ amountInPaise: body.amountInPaise });
      setStep("success");
      haptics.impact();
    } catch {
      setError("Network error.");
    } finally {
      setPlacing(false);
    }
  }

  return (
    <AnimatePresence>
      {flow ? (
        <>
          <motion.button
            aria-label="Close checkout"
            className="absolute inset-0 z-40 bg-black/60"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-label="Checkout"
            data-no-swipe
            className="absolute inset-x-0 bottom-0 z-50 max-h-[88%] overflow-y-auto no-scrollbar rounded-t-3xl border border-b-0 border-border bg-surface p-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] shadow-pop"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 380, damping: 38 }}
          >
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-border" />

            {step !== "success" ? (
              <div className="mb-4 flex items-center gap-3 rounded-2xl bg-surface-2 p-3">
                <ProductThumb src={flow.product.imageUrl} alt={flow.product.title} sizes="48px" className="w-12" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{flow.product.title}</p>
                  <p className="text-xs text-muted">{formatPrice(flow.product.priceInPaise)}</p>
                  <AttributeChips attributes={flow.product.attributes} className="mt-1" />
                </div>
              </div>
            ) : null}

            <AnimatePresence mode="wait" initial={false}>
              {step === "address" ? (
                <motion.div
                  key="address"
                  initial={{ opacity: 0, x: 24 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -24 }}
                  transition={{ type: "spring", stiffness: 400, damping: 34 }}
                >
                  <h2 className="text-base font-semibold">Your details</h2>
                  <p className="mb-3 text-xs text-muted">No account needed — just your number and address.</p>

                  {error ? <p className="mb-3 rounded-xl bg-live/10 px-3 py-2 text-sm text-live">{error}</p> : null}

                  <div className="space-y-2.5">
                    <input
                      type="text"
                      value={contact.buyerName}
                      onChange={(e) => update("buyerName", e.target.value)}
                      placeholder="Full name"
                      className="w-full rounded-xl border border-border bg-surface-2 px-3 py-2.5 text-sm outline-none focus:border-primary/50"
                    />
                    <input
                      type="tel"
                      inputMode="numeric"
                      value={contact.buyerPhone}
                      onChange={(e) => update("buyerPhone", e.target.value.replace(/[^\d]/g, ""))}
                      placeholder="Mobile number"
                      className="w-full rounded-xl border border-border bg-surface-2 px-3 py-2.5 text-sm outline-none focus:border-primary/50"
                    />
                    <input
                      type="text"
                      value={contact.addressLine1}
                      onChange={(e) => update("addressLine1", e.target.value)}
                      placeholder="Address line 1"
                      className="w-full rounded-xl border border-border bg-surface-2 px-3 py-2.5 text-sm outline-none focus:border-primary/50"
                    />
                    <input
                      type="text"
                      value={contact.addressLine2}
                      onChange={(e) => update("addressLine2", e.target.value)}
                      placeholder="Address line 2 (optional)"
                      className="w-full rounded-xl border border-border bg-surface-2 px-3 py-2.5 text-sm outline-none focus:border-primary/50"
                    />
                    <div className="flex gap-2.5">
                      <input
                        type="text"
                        value={contact.city}
                        onChange={(e) => update("city", e.target.value)}
                        placeholder="City"
                        className="w-1/2 rounded-xl border border-border bg-surface-2 px-3 py-2.5 text-sm outline-none focus:border-primary/50"
                      />
                      <input
                        type="text"
                        value={contact.state}
                        onChange={(e) => update("state", e.target.value)}
                        placeholder="State"
                        className="w-1/2 rounded-xl border border-border bg-surface-2 px-3 py-2.5 text-sm outline-none focus:border-primary/50"
                      />
                    </div>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={contact.pincode}
                      onChange={(e) => update("pincode", e.target.value.replace(/[^\d]/g, ""))}
                      placeholder="Pincode"
                      className="w-full rounded-xl border border-border bg-surface-2 px-3 py-2.5 text-sm outline-none focus:border-primary/50"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      haptics.tap();
                      const validationError = validAddress();
                      if (validationError) {
                        setError(validationError);
                        return;
                      }
                      setError(null);
                      setStep("payment");
                    }}
                    className="mt-4 w-full rounded-full bg-primary py-3 text-sm font-semibold text-primary-foreground transition-all active:scale-[0.98]"
                  >
                    Next — review order
                  </button>
                </motion.div>
              ) : step === "payment" ? (
                <motion.div
                  key="payment"
                  initial={{ opacity: 0, x: 24 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -24 }}
                  transition={{ type: "spring", stiffness: 400, damping: 34 }}
                >
                  <div className="mb-3 flex items-center justify-between">
                    <h2 className="text-base font-semibold">Confirm order</h2>
                    <button type="button" onClick={() => setStep("address")} className="text-xs font-medium text-primary">
                      ← Edit details
                    </button>
                  </div>

                  {error ? <p className="mb-3 rounded-xl bg-live/10 px-3 py-2 text-sm text-live">{error}</p> : null}

                  <p className="mb-3 rounded-xl bg-surface-2 px-3 py-2 text-xs leading-relaxed text-muted">
                    Delivering to <span className="font-medium text-foreground">{contact.buyerName}</span>,{" "}
                    {contact.addressLine1}
                    {contact.addressLine2 ? `, ${contact.addressLine2}` : ""}, {contact.city} — {contact.pincode}
                    <br />
                    📱 {contact.buyerPhone}
                  </p>

                  <div className="rounded-2xl border border-primary/50 bg-primary/5">
                    <div className="flex items-center gap-3 p-4">
                      <span className="text-xl">💵</span>
                      <span className="flex-1">
                        <span className="block text-sm font-semibold">Cash on Delivery</span>
                        <span className="text-xs text-muted">
                          Pay when it arrives · +{formatPrice(COD_DELIVERY_FEE_PAISE)} delivery
                        </span>
                      </span>
                    </div>
                    <div className="border-t border-border/60 px-4 py-3">
                      <Row label="Item total" value={formatPrice(totals.itemsInPaise)} />
                      <Row label="Delivery charge" value={formatPrice(totals.deliveryFeeInPaise)} />
                      <div className="my-2 border-t border-dashed border-border" />
                      <Row label="Total payable" value={formatPrice(totals.totalInPaise)} strong />
                      <button
                        type="button"
                        disabled={placing}
                        onClick={placeOrder}
                        className="mt-3 w-full rounded-full bg-primary py-3 text-sm font-semibold text-primary-foreground transition-all active:scale-[0.98] disabled:opacity-50"
                      >
                        {placing ? "Placing order…" : `Place order · ${formatPrice(totals.totalInPaise)}`}
                      </button>
                    </div>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="success"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ type: "spring", stiffness: 320, damping: 24 }}
                  className="flex flex-col items-center py-6 text-center"
                >
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 380, damping: 16, delay: 0.05 }}
                    className="flex h-16 w-16 items-center justify-center rounded-full bg-success/15 text-3xl"
                  >
                    🎉
                  </motion.span>
                  <h2 className="mt-4 text-lg font-bold">Order placed!</h2>
                  <p className="mt-1 max-w-xs text-sm text-muted">
                    {flow.product.title} is yours — keep{" "}
                    {placedOrder ? formatPrice(placedOrder.amountInPaise) : ""} ready for delivery.
                  </p>
                  <button
                    type="button"
                    onClick={onClose}
                    className="mt-6 w-full rounded-full bg-primary py-3 text-sm font-semibold text-primary-foreground transition-all active:scale-[0.98]"
                  >
                    Back to live
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  );
}

function Row({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className={cn("text-xs", strong ? "font-semibold text-foreground" : "text-muted")}>{label}</span>
      <span className={cn("tabular-nums", strong ? "text-sm font-bold" : "text-xs font-medium")}>{value}</span>
    </div>
  );
}
