/**
 * Order pricing — this demo only supports Cash on Delivery, which carries a
 * flat delivery charge (online payment would be free, but that flow doesn't
 * exist here).
 */
export const COD_DELIVERY_FEE_PAISE = 3500; // ₹35

export type PriceBreakdown = {
  itemsInPaise: number;
  deliveryFeeInPaise: number;
  totalInPaise: number;
};

export function priceBreakdown(itemsInPaise: number): PriceBreakdown {
  return {
    itemsInPaise,
    deliveryFeeInPaise: COD_DELIVERY_FEE_PAISE,
    totalInPaise: itemsInPaise + COD_DELIVERY_FEE_PAISE,
  };
}
