// Prints only the bill: loads it into a hidden iframe and prints that frame, so the admin UI never reaches the paper.
export function printInvoice(html: string): Promise<void> {
  return new Promise(resolve => {
    const frame = document.createElement('iframe');
    frame.setAttribute('aria-hidden', 'true');
    frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
    frame.onload = () => {
      const win = frame.contentWindow;
      if (!win) { frame.remove(); resolve(); return; }
      win.addEventListener('afterprint', () => { frame.remove(); resolve(); }, { once: true });
      win.focus();
      win.print();
    };
    frame.srcdoc = html;
    document.body.appendChild(frame);
  });
}
