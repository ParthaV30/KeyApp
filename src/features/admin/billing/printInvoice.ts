import * as Print from 'expo-print';

// Opens the system print sheet, which also offers "Save as PDF" on Android and iOS.
export async function printInvoice(html: string): Promise<void> {
  await Print.printAsync({ html });
}
