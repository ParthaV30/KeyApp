import type { ImageSource } from 'expo-image';

export type Product = {
  id: string;
  slug: string;
  name: string;
  category: string;
  price: number;
  priceLabel: string;
  image: ImageSource | number | string;
  tag?: string;
  description: string;
  stockQuantity?: number;
  hasVariants?: boolean;
  imageUrl?: string | null;
  sku?: string | null;
  brand?: string;
  isActive?: boolean;
  hsnSac?: string | null;
  gstRate?: number | null;
};

export const products: Product[] = [
  { id: '1', slug: 'xhorse-keytool-midi', name: 'Xhorse Keytool Midi Advanced Version', category: 'Programming Tools', price: 135000, priceLabel: '₹0 – ₹1,35,000', image: require('../../assets/images/catalog/midi.jpg'), tag: 'TOP SELLER', description: 'A versatile key programming tool from the Xhorse range with full transponder generation and cloning capabilities.', hasVariants: true, brand: 'XHORSE' },
  { id: '2', slug: 'xhorse-keytool-max-pro', name: 'Xhorse Keytool Max Pro', category: 'Programming Tools', price: 79000, priceLabel: '₹0 – ₹79,000', image: require('../../assets/images/catalog/max-pro.jpg'), tag: 'POPULAR', description: 'Smart key and remote programming equipment with built-in OBD functions for professional locksmiths.', hasVariants: true, brand: 'XHORSE' },
  { id: '3', slug: 'xhorse-keytool-plus-va', name: 'Xhorse Keytool Plus (VA Version)', category: 'Programming Tools', price: 170000, priceLabel: '₹0 – ₹1,70,000', image: require('../../assets/images/catalog/keytool-plus.jpg'), tag: 'FLAGSHIP', description: 'All-in-one automotive security solution integrating IMMO, key programming, and diagnostics.', hasVariants: true, brand: 'XHORSE' },
  { id: '4', slug: 'crosslink-wheels-flip-remote-b30', name: 'Crosslink Wheels Flip Remote B30', category: 'Remote Shell (Case)', price: 360, priceLabel: '₹360', image: require('../../assets/images/catalog/crosslink.jpg'), tag: 'NEW ARRIVAL', description: 'Universal flip remote shell with premium crosslink wheels finish.', brand: 'KEYCARE' },
  { id: '5', slug: 'eagle-bike-flip-ktm', name: 'Eagle Bike Flip — KTM', category: 'Bike Flip Keys', price: 75, priceLabel: '₹75', image: require('../../assets/images/catalog/ktm-flip.jpg'), tag: 'BIKE KEY', description: 'Precision flip key shell engineered for KTM motorcycle applications.', brand: 'RG' },
  { id: '6', slug: 'kc-classic-bmw-cas4-red', name: 'KC Classic — BMW CAS4 (Red)', category: 'Smart Shell (Case)', price: 152, priceLabel: '₹152', image: require('../../assets/images/catalog/bmw-cas4.jpg'), description: 'Classic red replacement smart key shell for BMW CAS4.', brand: 'KEYCARE' },
  { id: '7', slug: 'kc-classic-hyundai-4b-smart', name: 'KC Classic — Hyundai 4B New Smart', category: 'Smart Shell (Case)', price: 128, priceLabel: '₹128', image: require('../../assets/images/catalog/hyundai-smart.jpg'), tag: 'BEST VALUE', description: 'Blue 4-button smart key shell for compatible Hyundai models.', brand: 'KEYCARE' },
  { id: '8', slug: 'brown-mt-suzuki-swift-2b', name: 'Brown MT — Suzuki Swift 2B', category: 'Remote Shell (Case)', price: 180, priceLabel: '₹170 – ₹180', image: require('../../assets/images/catalog/suzuki-swift.jpg'), description: 'Replacement 2-button remote shell for Suzuki Swift and Dzire.', hasVariants: true, brand: 'KEYLIFE' },
  { id: '9', slug: 'leather-keychains-hero', name: 'Leather Keychains 2 — Hero', category: 'Keychains', price: 60, priceLabel: '₹60', image: require('../../assets/images/catalog/leather-keychains.jpg'), description: 'Premium stitched leather keychain accessory from the Hero collection.', brand: 'GIRIRAJA' },
  { id: '10', slug: 'key-ring-1-inch-pack-288', name: 'Key Ring 1 inch — Pack of 288', category: 'Part & Accessories', price: 220, priceLabel: '₹220', image: require('../../assets/images/catalog/key-ring.png'), description: 'Wholesale bulk pack of 288 nickel-plated 1-inch key rings.', brand: 'GIRIRAJA' },
  { id: '11', slug: 'keylife-carbide-cutter-1-5mm', name: 'Keylife 1.5mm Welded Carbide Cutter', category: 'Cutters & Bit', price: 480, priceLabel: '₹480', image: require('../../assets/images/catalog/keylife-cutter.png'), tag: 'KEYLIFE', description: '1.5mm tungsten carbide cutter for automated key cutting machines.', brand: 'JMR KEYLIFE' },
  { id: '12', slug: 'classic-sc-suzuki-swift-2b-type-1', name: 'Classic SC — Suzuki Swift 2B Type 1', category: 'KMD Blades', price: 45, priceLabel: '₹38 – ₹45', image: require('../../assets/images/catalog/classic-swift-1.jpg'), description: 'Classic SC two-button key blank blade for Suzuki Swift.', hasVariants: true, brand: 'MINDA SILCA' },
  { id: '13', slug: 'classic-sc-suzuki-swift-2b-type-2', name: 'Classic SC — Suzuki Swift 2B Type 2', category: 'Minda Silca Blades', price: 50, priceLabel: '₹38 – ₹50', image: require('../../assets/images/catalog/classic-swift-2.jpg'), description: 'Minda Silca precision key blade blank for Suzuki Swift.', hasVariants: true, brand: 'MINDA SILCA' },
  { id: '14', slug: 'goso-inside-lever-lock-decoder-pick', name: 'Goso Inside Lever Lock Decoder & Pick Tool', category: 'Decoder Tool', price: 1780, priceLabel: '₹1,730 – ₹1,780', image: require('../../assets/images/catalog/goso-lock-tool.png'), tag: 'LOCKSMITH TOOL', description: 'Professional stainless decoder and pick tool for inside lever mortise locks.', hasVariants: true, brand: 'XTOOL' },
];

export type ProductCategory = {
  name: string;
  slug?: string;
  icon: string;
  count: string;
  color: string;
  image?: ImageSource | number | string;
  imageUrl?: string | null;
};

export type ProductVariant = {
  id: string;
  productId: string;
  name: string;
  price: number;
  stockQuantity: number;
  sku: string | null;
};

export const categories: ProductCategory[] = [
  { name: 'Alarm System', slug: 'alarm-system-admin', icon: '⚡', count: 'Vehicle alarm systems', color: '#FEF3C7', image: require('../../assets/images/categories/alarm-system.jpg') },
  { name: 'Car Remote Cover', slug: 'car-remote-cover-admin', icon: '🚗', count: 'Protective remote covers', color: '#E0F2FE', image: require('../../assets/images/categories/car-remote-cover.jpg') },
  { name: 'Car Accessories', slug: 'car-accessories-admin', icon: '🛡️', count: 'Automotive accessories', color: '#FEF9C3', image: require('../../assets/images/categories/car-accessories.jpg') },
  { name: 'Remote Shell (Case)', slug: 'remote-shell-case-1-admin', icon: '🚗', count: 'Flip and remote key cases', color: '#E0F2FE', image: require('../../assets/images/categories/remote-shell-case-1.jpg') },
  { name: 'Smart Shell (Case)', slug: 'smart-shell-case-1-admin', icon: '📱', count: 'Smart key replacement shells', color: '#EDE9FE', image: require('../../assets/images/categories/smart-shell-case-1.jpg') },
  { name: 'ID Key Shell', slug: 'id-key-shell-1-admin', icon: '🏷️', count: 'Transponder key shells', color: '#FCE7F3', image: require('../../assets/images/categories/id-key-shell-1.jpg') },
  { name: 'Remotes', slug: 'remotes-1-admin', icon: '📻', count: 'Remote controls and fobs', color: '#DCFCE7', image: require('../../assets/images/categories/remotes-1.jpg') },
  { name: 'Smart Keys', slug: 'smart-keys-admin', icon: '🔑', count: 'Smart key fobs', color: '#E0E7FF', image: require('../../assets/images/categories/smart-keys.jpg') },
  { name: 'PCB MB', slug: 'pcb-mb-admin', icon: '🔌', count: 'Remote and key circuit boards', color: '#E0E7FF', image: require('../../assets/images/categories/pcb-mb.jpg') },
  { name: 'Xhorse Remote', slug: 'xhorse-remote-1-admin', icon: '⚙️', count: 'Xhorse remotes', color: '#F3E8FF', image: require('../../assets/images/categories/xhorse-remote-1.jpg') },
  { name: 'Keydiy Remote', slug: 'keydiy-remote-admin', icon: '📟', count: 'Keydiy remotes', color: '#ECFDF5', image: require('../../assets/images/categories/keydiy-remote.jpg') },
  { name: 'CG & AIK Remotes', slug: 'cg-aik-remotes-admin', icon: '📻', count: 'CG and AIK remotes', color: '#DCFCE7', image: require('../../assets/images/categories/cg-aik-remotes.jpg') },
  { name: 'Keypad', slug: 'keypad-admin', icon: '⌨️', count: 'Keypads and buttons', color: '#F3E8FF', image: require('../../assets/images/categories/keypad.jpg') },
  { name: 'Blades', slug: 'blades-1-admin', icon: '🗡️', count: 'Automotive key blades', color: '#FEE2E2', image: require('../../assets/images/categories/blades-1.jpg') },
  { name: 'ID Transponders', slug: 'id-transponders-admin', icon: '💾', count: 'Transponder chips', color: '#FEF9C3', image: require('../../assets/images/categories/id-transponders.jpg') },
  { name: 'Logo Stickers', slug: 'logo-stickers-admin', icon: '🏷️', count: 'Vehicle logo stickers', color: '#FCE7F3', image: require('../../assets/images/categories/logo-stickers.jpg') },
  { name: 'Soldering Buttons', slug: 'soldering-buttons-admin', icon: '🔘', count: 'Micro switches and buttons', color: '#FCE7F3', image: require('../../assets/images/categories/soldering-buttons.jpg') },
  { name: 'Batteries', slug: 'batteries-1-admin', icon: '🔋', count: 'Key and remote batteries', color: '#DCFCE7', image: require('../../assets/images/categories/batteries-1.jpg') },
  { name: 'On Table Tool', slug: 'on-table-tool-admin', icon: '🔧', count: 'Bench locksmith tools', color: '#F1F5F9', image: require('../../assets/images/categories/on-table-tool.jpg') },
  { name: 'Immo & Lockset', slug: 'immo-lockset-1-admin', icon: '🔓', count: 'Immobilizer and lock sets', color: '#FEF3C7', image: require('../../assets/images/categories/immo-lockset-1.jpg') },
  { name: 'LCD Display Keys', slug: 'lcd-display-keys-1-admin', icon: '📱', count: 'Keys with LCD displays', color: '#EDE9FE', image: require('../../assets/images/categories/lcd-display-keys-1.jpg') },
  { name: 'Programming Tool', slug: 'programming-tool-1-admin', icon: '💻', count: 'Key programming tools', color: '#E0F2FE', image: require('../../assets/images/categories/programming-tool-1.jpg') },
  { name: 'Auto Cut Machine', slug: 'auto-cut-machine-admin', icon: '⚡', count: 'Automatic key cutting machines', color: '#FEE2E2', image: require('../../assets/images/categories/auto-cut-machine.jpg') },
  { name: 'Manual Cut Machine', slug: 'manual-cut-machine-admin', icon: '🔧', count: 'Manual key cutting machines', color: '#F1F5F9', image: require('../../assets/images/categories/manual-cut-machine.jpg') },
  { name: '2 Wheelers Keys', slug: '2-wheelers-keys-admin', icon: '🏍️', count: 'Two-wheeler keys', color: '#FFEDD5', image: require('../../assets/images/categories/2-wheelers-keys.jpg') },
  { name: 'Super Bike Keys', slug: 'super-bike-keys-admin', icon: '🏍️', count: 'Performance motorcycle keys', color: '#FFEDD5', image: require('../../assets/images/categories/super-bike-keys.jpg') },
  { name: 'EV Vehicle', slug: 'ev-electric-vehicle-1-admin', icon: '⚡', count: 'Electric vehicle keys', color: '#DCFCE7', image: require('../../assets/images/categories/ev-electric-vehicle-1.jpg') },
  { name: '3 Wheelers', slug: '3-wheelers-keys-1-admin', icon: '🚗', count: 'Three-wheeler vehicle keys', color: '#E0F2FE', image: require('../../assets/images/categories/3-wheelers-keys-1.jpg') },
  { name: '4 Wheelers', slug: '4-wheelers-keys-1-admin', icon: '🚗', count: 'Four-wheeler vehicle keys', color: '#E0F2FE', image: require('../../assets/images/categories/4-wheelers-keys-1.jpg') },
  { name: 'Commercial Vehicles', slug: 'commercial-vehicles-admin', icon: '🚗', count: 'Commercial vehicle keys', color: '#E0F2FE', image: require('../../assets/images/categories/commercial-vehicles.jpg') },
  { name: 'Tractor Keys', slug: 'tractor-keys-admin', icon: '🚗', count: 'Tractor keys and blanks', color: '#DCFCE7', image: require('../../assets/images/categories/tractor-keys.jpg') },
  { name: 'Domestic Keys', slug: 'domestic-keys-1-admin', icon: '🔑', count: 'House and domestic keys', color: '#FEF3C7', image: require('../../assets/images/categories/domestic-keys-1.jpg') },
  { name: 'Decoder Tool', slug: 'decoder-tool-1-admin', icon: '🔓', count: 'Key decoding tools', color: '#FEF3C7', image: require('../../assets/images/categories/decoder-tool-1.jpg') },
  { name: 'Bike Flip Keys', slug: 'bike-flip-keys-admin', icon: '🏍️', count: 'Motorcycle flip keys', color: '#FFEDD5', image: require('../../assets/images/categories/bike-flip-keys.jpg') },
  { name: 'Fancy Keys', slug: 'fancy-keys-admin', icon: '✨', count: 'Decorative key blanks', color: '#EDE9FE', image: require('../../assets/images/categories/fancy-keys.jpg') },
  { name: 'Display Unit', slug: 'display-unit-1-admin', icon: '📟', count: 'Product display units', color: '#E0E7FF', image: require('../../assets/images/categories/display-unit-1.jpg') },
  { name: 'Cutters & Bit', slug: 'cutters-bit-1-admin', icon: '💎', count: 'Cutters and machine bits', color: '#EDE9FE', image: require('../../assets/images/categories/cutters-bit-1.jpg') },
  { name: 'Part & Accessories', slug: 'part-accessories-1-admin', icon: '🔧', count: 'Parts and accessories', color: '#F1F5F9', image: require('../../assets/images/categories/part-accessories-1.jpg') },
  { name: 'Hand Tools', slug: 'hand-tools-1-admin', icon: '🔧', count: 'Hand tools for locksmiths', color: '#F1F5F9', image: require('../../assets/images/categories/hand-tools-1.jpg') },
  { name: 'Locks', slug: 'locks-admin', icon: '🔓', count: 'Locks and lock hardware', color: '#FEF3C7', image: require('../../assets/images/categories/locks.jpg') },
  { name: 'Keychains', slug: 'keychains-admin', icon: '✨', count: 'Keychains and rings', color: '#FFEDD5', image: require('../../assets/images/categories/keychains.jpg') },
  { name: 'Others', slug: 'others-1-admin', icon: '✨', count: 'More locksmith essentials', color: '#E0E7FF', image: require('../../assets/images/categories/others-1.jpg') },
];

export const brands = [
  { name: 'JMR KEYLIFE', image: require('../../assets/images/brands/jmr-keylife.png') },
  { name: 'XHORSE', image: require('../../assets/images/brands/xhorse.png') },
  { name: 'KEYCARE', image: require('../../assets/images/brands/keycare.png') },
  { name: 'MINDA SILCA', image: require('../../assets/images/brands/minda-silca.png') },
  { name: 'RG', image: require('../../assets/images/brands/rg.png') },
  { name: 'STELLAR DRIVE', image: require('../../assets/images/brands/stellar-drive.png') },
  { name: 'XTOOL', image: require('../../assets/images/brands/xtool.png') },
  { name: 'LAUNCH', image: require('../../assets/images/brands/launch.png') },
  { name: 'AUTEL', image: require('../../assets/images/brands/autel.png') },
  { name: 'AIK', image: require('../../assets/images/brands/aik.png') },
  { name: 'KEYDIY', image: require('../../assets/images/brands/keydiy.png') },
  { name: 'PANASONIC', image: require('../../assets/images/brands/panasonic.png') },
];

export const storeHighlights = [
  {
    title: 'Blank keys & locks',
    subtitle: 'Wholesale & retail hardware for every locksmith need',
    icon: '🔑',
  },
  {
    title: 'Same-day dispatch',
    subtitle: 'Order before 6 PM via app for prompt courier shipment',
    icon: '⚡',
  },
  {
    title: 'Trusted brands',
    subtitle: 'Authorized distributors with guaranteed genuine stock',
    icon: '🛡️',
  },
  {
    title: 'Bengaluru based',
    subtitle: '9+ years serving locksmiths & workshops across India',
    icon: '📍',
  },
];

export const storeStats = [
  { value: '5,000+', label: 'Products' },
  { value: '20+', label: 'Brand Distributors' },
  { value: '42+', label: 'Categories' },
  { value: '9+', label: 'Years Trust' },
];

export const storeContact = {
  phone: '917022225055',
  displayPhone: '+91 7022225055',
  whatsappUrl: 'https://wa.me/7022225055',
  email: 'info@suriyakeycentre.com',
  address: 'Giriraja, Bengaluru, Karnataka, India',
};
