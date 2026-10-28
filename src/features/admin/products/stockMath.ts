// Stock helpers for the product admin. Options are still saved in the existing
// "name | price | stock | SKU" text format, so these convert to and from editable rows.

export type OptionRow = { name: string; price: string; stock: string; sku: string };

const LOW_STOCK_DEFAULT = 5;
const clean = (value: string) => value.replace(/\|/g, '/').trim();

export function parseOptionLines(text: string): OptionRow[] {
  return text.split(/\r?\n/).map(line => line.trim()).filter(Boolean).map(line => {
    const [name = '', price = '', stock = '', sku = ''] = line.split('|').map(part => part.trim());
    return { name, price, stock, sku };
  });
}

export function serializeOptionLines(rows: readonly OptionRow[]): string {
  return rows
    .filter(row => row.name.trim() || row.price.trim() || row.stock.trim() || row.sku.trim())
    .map(row => `${clean(row.name)} | ${clean(row.price)} | ${clean(row.stock)} | ${clean(row.sku)}`)
    .join('\n');
}

export function stockStatus(quantity: number, lowAt = LOW_STOCK_DEFAULT): { label: string; tone: 'good' | 'warn' | 'bad' } {
  if (quantity <= 0) return { label: 'Out of stock', tone: 'bad' };
  if (quantity <= lowAt) return { label: `Low stock · ${quantity}`, tone: 'warn' };
  return { label: `In stock · ${quantity}`, tone: 'good' };
}

export function stockChange(current: number, input: string): { delta: number; error?: undefined } | { error: string; delta?: undefined } {
  const trimmed = input.trim();
  const target = Number(trimmed);
  if (!trimmed || !Number.isInteger(target) || target < 0) return { error: 'Enter the stock count as a whole number (0 or more).' };
  if (target === current) return { error: `Stock is already ${current}.` };
  return { delta: target - current };
}
