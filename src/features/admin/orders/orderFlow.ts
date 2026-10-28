// The order lifecycle as the shop owner sees it. Status values match the orders.status check
// constraint; labels and hints are the words shown in the admin panel.

export type StepState = 'done' | 'current' | 'upcoming' | 'cancelled';
export type OrderAction = { status: string; label: string; hint: string };

export const ORDER_STEPS = [
  { status: 'pending', label: 'Placed' },
  { status: 'confirmed', label: 'Confirmed' },
  { status: 'processing', label: 'Packing' },
  { status: 'shipped', label: 'Shipped' },
  { status: 'delivered', label: 'Delivered' },
] as const;

const ACTIONS: Record<string, OrderAction> = {
  pending: { status: 'confirmed', label: 'Confirm order', hint: 'Check the items are in stock, then confirm so the customer knows it is accepted.' },
  confirmed: { status: 'processing', label: 'Start packing', hint: 'Use this once you start picking and packing the items.' },
  processing: { status: 'shipped', label: 'Mark as shipped', hint: 'Use this when the parcel has left the shop or been handed to the courier.' },
  shipped: { status: 'delivered', label: 'Mark as delivered', hint: 'Use this once the customer has received the order and paid on delivery.' },
};

const LABELS: Record<string, string> = { pending: 'New', confirmed: 'Confirmed', processing: 'Packing', shipped: 'Shipped', delivered: 'Delivered', cancelled: 'Cancelled' };

export function nextOrderAction(status: string): OrderAction | null {
  return ACTIONS[status] ?? null;
}

export function orderStepStates(status: string): StepState[] {
  if (status === 'cancelled') return ORDER_STEPS.map(() => 'cancelled');
  const reached = ORDER_STEPS.findIndex(step => step.status === status);
  const delivered = status === 'delivered';
  return ORDER_STEPS.map((_, index) => {
    if (index < reached || (delivered && index === reached)) return 'done';
    return index === reached ? 'current' : 'upcoming';
  });
}

export function canCancelOrder(status: string): boolean {
  return status === 'pending' || status === 'confirmed' || status === 'processing';
}

export function orderStatusLabel(status: string): string {
  return LABELS[status] ?? status;
}
