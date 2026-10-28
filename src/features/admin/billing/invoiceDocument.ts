// Builds the printable bill as one HTML document. The invoice screen previews this exact HTML and prints it,
// so what staff see on screen is what the customer gets on paper or PDF.

type Amount = number | string | null | undefined;

export type InvoiceDocumentData = {
  invoice_code: string;
  issue_date: string;
  status: string;
  seller_name: string;
  seller_address: string;
  seller_city: string;
  seller_state: string;
  seller_postal_code: string;
  seller_gstin: string;
  buyer_name: string;
  buyer_phone: string;
  buyer_address: string;
  buyer_city: string;
  buyer_state: string;
  buyer_postal_code: string;
  buyer_gstin: string;
  subtotal: Amount;
  cgst_total: Amount;
  sgst_total: Amount;
  igst_total: Amount;
  shipping_fee: Amount;
  total: Amount;
  paid_total: Amount;
  credited_total: Amount;
  notes: string;
  billing_invoice_items: { id: string; product_name: string; variant_name: string; hsn_sac: string; quantity: number; unit_price: Amount; taxable_value: Amount; line_total: Amount }[];
};

export type InvoiceProfile = {
  phone?: string;
  email?: string;
  bankAccountName?: string;
  bankName?: string;
  bankAccountNumber?: string;
  bankIfsc?: string;
  bankBranch?: string;
  upiId?: string;
  terms?: string;
};

const escapeHtml = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character] ?? character);
const num = (value: Amount) => Number(value ?? 0) || 0;

// Bill figures follow the sample: Indian digit grouping, no currency sign, paise only when present.
const figure = (value: Amount) => {
  const amount = num(value);
  const hasPaise = Math.round(amount * 100) % 100 !== 0;
  return amount.toLocaleString('en-IN', { minimumFractionDigits: hasPaise ? 2 : 0, maximumFractionDigits: 2 });
};

export function formatBillDate(value: string): string {
  const [year, month, day] = value.slice(0, 10).split('-');
  return day && month && year ? `${day}.${month}.${year}` : value;
}

const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function belowHundred(n: number): string {
  return n < 20 ? ONES[n] : [TENS[Math.floor(n / 10)], ONES[n % 10]].filter(Boolean).join(' ');
}

function belowThousand(n: number): string {
  const hundreds = Math.floor(n / 100);
  return [hundreds ? `${ONES[hundreds]} Hundred` : '', belowHundred(n % 100)].filter(Boolean).join(' ');
}

function wholeInWords(n: number): string {
  if (n === 0) return 'Zero';
  const parts: string[] = [];
  const crore = Math.floor(n / 10_000_000);
  const lakh = Math.floor((n % 10_000_000) / 100_000);
  const thousand = Math.floor((n % 100_000) / 1000);
  const rest = n % 1000;
  if (crore) parts.push(`${wholeInWords(crore)} Crore`);
  if (lakh) parts.push(`${belowHundred(lakh)} Lakh`);
  if (thousand) parts.push(`${belowHundred(thousand)} Thousand`);
  if (rest) parts.push(belowThousand(rest));
  return parts.join(' ');
}

export function rupeesInWords(value: Amount): string {
  const paiseTotal = Math.round(num(value) * 100);
  const rupees = Math.floor(paiseTotal / 100);
  const paise = paiseTotal % 100;
  return `Rupees ${wholeInWords(rupees)}${paise ? ` and ${belowHundred(paise)} Paise` : ''} Only`;
}

const CSS = `
@page{size:A4;margin:10mm}
*{box-sizing:border-box}
body{margin:0;padding:16px;background:#fff;color:#000;font-family:"Times New Roman",Times,serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.bill{max-width:780px;margin:0 auto;border:2px solid #000}
table{width:100%;border-collapse:collapse}
td,th{border:1px solid #000;vertical-align:top}
.head td{border-top:0}
.head td:first-child,.party td:first-child,.items td:first-child,.items th:first-child,.foot td:first-child{border-left:0}
.head td:last-child,.party td:last-child,.items td:last-child,.items th:last-child,.foot td:last-child{border-right:0}
.seller{text-align:center;padding:8px 10px}
.seller .name{font-size:30px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;line-height:1.15}
.seller .line{font-family:Arial,Helvetica,sans-serif;font-weight:700;font-size:13px;line-height:1.5}
.meta{width:32%;padding:0}
.meta div{padding:7px 8px;border-bottom:1px solid #000;font-weight:700;font-size:15px}
.meta div:last-child{border-bottom:0}
.meta .doc{text-align:center;font-family:Arial,Helvetica,sans-serif;font-size:15px}
.party td{padding:6px 8px;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:700;width:50%}
.party .k{display:inline-block;min-width:122px}
.party .v{font-weight:700}
.party .to{display:block;margin-bottom:2px}
.items th{background:#B4C6E7;font-size:14px;padding:10px 4px;text-transform:uppercase;border-bottom:2px solid #000}
.items td{font-size:15px;padding:7px 6px}
.items .sl{width:7%;text-align:center}
.items th.sl{text-transform:none}
.items .particulars{text-transform:uppercase}
.items small{display:block;font-size:11px;color:#333;text-transform:none}
.items .qty{width:10%;text-align:center}
.items .rate{width:14%}
.items .amt{width:17%}
.items .num{text-align:center}
.items tfoot td{font-size:15px}
.items .label{text-align:right;font-weight:700;padding-right:10px}
.items .grand td{border-top:2px solid #000;font-size:22px;font-weight:700;padding:10px 6px}
.items .grand .label{text-align:center}
.words{padding:8px 10px;border-top:1px solid #000;font-family:Arial,Helvetica,sans-serif;font-size:13px}
.foot td{border-bottom:0;padding:10px;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.55}
.foot .sign{width:42%;text-align:right;font-family:"Times New Roman",Times,serif;font-size:15px}
.foot .sign b{font-size:17px;text-transform:uppercase}
.foot .sign .who{margin-top:46px;font-family:Arial,Helvetica,sans-serif;font-size:12px}
.terms{margin-top:6px;font-size:11px;color:#333}
.draft{max-width:780px;margin:0 auto 10px;padding:7px 10px;border:1px dashed #B23A2E;color:#B23A2E;background:#FBE9E6;font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:700;letter-spacing:.4px;text-align:center}
.bill.is-draft{position:relative}
.bill.is-draft::after{content:"DRAFT";position:absolute;top:42%;left:50%;transform:translate(-50%,-50%) rotate(-24deg);font-family:Arial,Helvetica,sans-serif;font-size:120px;font-weight:800;color:rgba(178,58,46,.08);pointer-events:none;letter-spacing:8px}
`;

export function buildInvoiceHtml(invoice: InvoiceDocumentData, profile: InvoiceProfile, options: { draft?: boolean } = {}): string {
  const isTaxInvoice = Boolean(invoice.seller_gstin);
  const taxShown = isTaxInvoice && num(invoice.cgst_total) + num(invoice.sgst_total) + num(invoice.igst_total) > 0;
  const sellerAddress = [invoice.seller_address, invoice.seller_city, invoice.seller_postal_code ? `${invoice.seller_state} - ${invoice.seller_postal_code}` : invoice.seller_state].filter(Boolean).join(', ');
  const buyerAddress = [invoice.buyer_address, invoice.buyer_city, invoice.buyer_state, invoice.buyer_postal_code].filter(Boolean).join(', ');
  const contact = [profile.phone ? `Mobile : ${escapeHtml(profile.phone)}` : '', profile.email ? `E-mail : ${escapeHtml(profile.email)}` : ''].filter(Boolean).join(',&nbsp; ');

  const rows = invoice.billing_invoice_items.map((item, index) => {
    const amount = taxShown ? num(item.taxable_value) : num(item.line_total);
    const rate = taxShown ? amount / (item.quantity || 1) : num(item.unit_price);
    const details = [item.variant_name, item.hsn_sac ? `HSN/SAC ${item.hsn_sac}` : ''].filter(Boolean).map(escapeHtml).join(' · ');
    return `<tr>
      <td class="sl">${index + 1}</td>
      <td class="particulars">${escapeHtml(item.product_name)}${details ? `<small>${details}</small>` : ''}</td>
      <td class="num">${item.quantity}</td>
      <td class="num">${figure(rate)}</td>
      <td class="num">${figure(amount)}</td>
    </tr>`;
  }).join('');

  const footRow = (label: string, value: Amount) => `<tr><td></td><td class="label" colspan="3">${label}</td><td class="num">${figure(value)}</td></tr>`;
  const taxRows = taxShown
    ? footRow('Taxable value', invoice.subtotal) + (num(invoice.igst_total) > 0 ? footRow('IGST', invoice.igst_total) : footRow('CGST', invoice.cgst_total) + footRow('SGST', invoice.sgst_total))
    : '';
  const deliveryRow = num(invoice.shipping_fee) > 0 ? footRow('Delivery charges', invoice.shipping_fee) : '';
  const settled = num(invoice.paid_total) + num(invoice.credited_total);
  const due = Math.max(0, num(invoice.total) - settled);
  const balanceRows = settled > 0 && due > 0
    ? footRow('Received', invoice.paid_total) + (num(invoice.credited_total) > 0 ? footRow('Credit note', invoice.credited_total) : '') + footRow('Balance due', due)
    : '';

  const bankLines = [
    profile.bankAccountName ? `A/c Name : ${escapeHtml(profile.bankAccountName)}` : '',
    profile.bankName ? `Bank : ${escapeHtml(profile.bankName)}${profile.bankBranch ? `, ${escapeHtml(profile.bankBranch)}` : ''}` : '',
    profile.bankAccountNumber ? `A/c No. : ${escapeHtml(profile.bankAccountNumber)}` : '',
    profile.bankIfsc ? `IFSC : ${escapeHtml(profile.bankIfsc)}` : '',
    profile.upiId ? `UPI : ${escapeHtml(profile.upiId)}` : '',
  ].filter(Boolean);

  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(invoice.invoice_code)}</title><style>${CSS}</style></head><body>
${options.draft ? '<div class="draft">DRAFT &middot; Not a valid invoice &middot; Preview before creating the bill</div>' : ''}
<div class="bill${options.draft ? ' is-draft' : ''}">
  <table class="head"><tr>
    <td class="seller">
      <div class="name">${escapeHtml(invoice.seller_name)}</div>
      ${sellerAddress ? `<div class="line">${escapeHtml(sellerAddress)}</div>` : ''}
      ${contact ? `<div class="line">${contact}</div>` : ''}
      ${isTaxInvoice ? `<div class="line">GSTIN : ${escapeHtml(invoice.seller_gstin)}</div>` : ''}
    </td>
    <td class="meta">
      <div class="doc">${isTaxInvoice ? 'TAX INVOICE' : 'INVOICE'}</div>
      <div>Invoice No. : ${escapeHtml(invoice.invoice_code)}</div>
      <div>Date : ${escapeHtml(formatBillDate(invoice.issue_date))}</div>
    </td>
  </tr></table>
  <table class="party">
    <tr>
      <td><span class="to">To</span><span class="k">Customer Name .:</span> <span class="v">${escapeHtml(invoice.buyer_name || 'Walk-in customer')}</span></td>
      <td><span class="to">&nbsp;</span><span class="k">Mobile .:</span> <span class="v">${escapeHtml(invoice.buyer_phone)}</span></td>
    </tr>
    <tr>
      <td><span class="k">Address .:</span> <span class="v">${escapeHtml(buyerAddress)}</span></td>
      <td><span class="k">GSTIN .:</span> <span class="v">${escapeHtml(invoice.buyer_gstin)}</span></td>
    </tr>
  </table>
  <table class="items">
    <thead><tr><th class="sl">Sl.No.</th><th>Particulars</th><th class="qty">Qty</th><th class="rate">Rate</th><th class="amt">Amount</th></tr></thead>
    <tbody>${rows}</tbody>
    <tfoot>
      ${taxRows}${deliveryRow}
      <tr class="grand"><td></td><td class="label">Total</td><td></td><td></td><td class="num">${figure(invoice.total)}</td></tr>
      ${balanceRows}
    </tfoot>
  </table>
  <div class="words"><b>Amount in words :</b> ${rupeesInWords(invoice.total)}</div>
  <table class="foot"><tr>
    <td>${bankLines.length ? `<b>Bank Details :</b><br>${bankLines.join('<br>')}` : ''}${profile.terms ? `<div class="terms">${escapeHtml(profile.terms)}</div>` : ''}${invoice.notes ? `<div class="terms">Note : ${escapeHtml(invoice.notes)}</div>` : ''}</td>
    <td class="sign">For <b>${escapeHtml(invoice.seller_name)}</b><div class="who">Authorised Signatory</div></td>
  </tr></table>
</div>
</body></html>`;
}
