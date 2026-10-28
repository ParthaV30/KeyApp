export type OrderRow = {
  id: string; order_number: number; status: string; created_at: string; updated_at?: string;
  subtotal?: number; shipping_fee?: number; total: number; payment_method?: string; payment_status?: string;
  shipping_name: string; shipping_phone: string; shipping_address: string; shipping_city: string;
  shipping_state?: string; shipping_postal_code?: string; shipping_gstin?: string; customer_note?: string;
};
export type OrderItemRow = { id: string; product_name: string; variant_name: string; sku: string | null; unit_price: number; quantity: number; line_total: number };
export type InvoiceRow = { id: string; order_id: string | null; invoice_code: string; issue_date: string; status: string; payment_status: string; total: number; paid_total: number; credited_total: number; buyer_name: string; buyer_phone: string };
export type AdminVariant = { id: string; product_id: string; name: string; price: number; stock_quantity: number; sku: string | null };
