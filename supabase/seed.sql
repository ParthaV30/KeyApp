insert into public.categories (name, slug, description, sort_order, is_active) values
  ('Car keys', 'car-keys', 'Key blanks and replacement shells', 1, true),
  ('Car remotes', 'car-remotes', 'Remote shells and smart keys', 2, true),
  ('Bike keys', 'bike-keys', 'Keys and remotes for two-wheelers', 3, true),
  ('Cutters', 'cutters', 'Key cutting machines and cutters', 4, true),
  ('Lock tools', 'lock-tools', 'Professional picks and decoders', 5, true),
  ('Accessories', 'accessories', 'Key rings and keychains', 6, true),
  ('Key programming tools', 'key-programming-tools', 'Vehicle key programming equipment', 7, true)
on conflict (slug) do update set name = excluded.name, description = excluded.description;

insert into public.products (slug, name, description, category_id, brand, price, has_variants, is_active, is_featured)
select d.slug, d.name, d.description, c.id, d.brand, d.price, d.has_variants, true, d.featured
from (values
  ('xhorse-keytool-midi', 'Xhorse Keytool Midi Advanced Version', 'A versatile key programming tool from the Xhorse range.', 'Key programming tools', 'Xhorse', null::numeric, true, true),
  ('xhorse-keytool-max-pro', 'Xhorse Keytool Max Pro', 'Smart key and remote programming equipment for professional locksmiths.', 'Key programming tools', 'Xhorse', null::numeric, true, true),
  ('xhorse-keytool-plus-va', 'Xhorse Keytool Plus (VA Version)', 'Advanced vehicle key programming from Xhorse.', 'Key programming tools', 'Xhorse', null::numeric, true, false),
  ('crosslink-wheels-flip-remote-b30', 'Crosslink Wheels Flip Remote B30', 'Flip remote shell with a crosslink wheel finish.', 'Car remotes', 'Crosslink', 360, false, true),
  ('eagle-bike-flip-ktm', 'Eagle Bike Flip — KTM', 'Flip key shell for KTM motorcycle applications.', 'Bike keys', 'Eagle', 75, false, false),
  ('kc-classic-bmw-cas4-red', 'KC Classic — BMW CAS4 (Red)', 'Classic red replacement key shell for BMW CAS4.', 'Car remotes', 'Key Centre', 152, false, false),
  ('kc-classic-hyundai-4b-smart', 'KC Classic — Hyundai 4B New Smart', 'Blue four-button smart key shell for compatible Hyundai models.', 'Car remotes', 'Key Centre', 128, false, true),
  ('brown-mt-suzuki-swift-2b', 'Brown MT — Suzuki Swift 2B', 'Replacement two-button remote shell for Suzuki Swift.', 'Car keys', 'Brown MT', 180, true, false),
  ('leather-keychains-hero', 'Leather Keychains 2 — Hero', 'Leather keychain accessory from the Hero collection.', 'Accessories', 'Hero', 60, false, false),
  ('key-ring-1-inch-pack-288', 'Key Ring 1 inch — Pack of 288', 'Bulk pack of 288 one-inch key rings.', 'Accessories', 'Key Centre', 220, false, false),
  ('keylife-carbide-cutter-1-5mm', 'Keylife 1.5mm Welded Carbide Cutter', '1.5mm welded carbide cutter for key cutting machines.', 'Cutters', 'Keylife', 480, false, true),
  ('classic-sc-suzuki-swift-2b-type-1', 'Classic SC — Suzuki Swift 2B Type 1', 'Classic SC two-button key blank for Suzuki Swift.', 'Car keys', 'Classic SC', 45, true, false),
  ('classic-sc-suzuki-swift-2b-type-2', 'Classic SC — Suzuki Swift 2B Type 2', 'Alternate Classic SC two-button key blank for Suzuki Swift.', 'Car keys', 'Classic SC', 50, true, false),
  ('goso-inside-lever-lock-decoder-pick', 'Goso Inside Lever Lock Decoder & Pick Tool', 'Decoder and pick tool for inside lever locks.', 'Lock tools', 'Goso', 1780, true, false)
) as d(slug, name, description, category_name, brand, price, has_variants, featured)
join public.categories c on c.name = d.category_name
on conflict (slug) do nothing;
