# Key Mitra

Key Mitra is a cross-platform Android and iOS storefront for Giriraja, built with Expo, React Native, TypeScript, and Expo Router. Supabase provides PostgreSQL, customer authentication, product image storage, and role-based data access.

## Features

- Customer accounts, sign-in, order history, and database-synced saved items
- Product search and categories, catalog details, options/variants, and stock-aware cart
- Cash-on-delivery checkout. The database calculates prices, checks stock, reserves inventory, and creates the order atomically.
- Admin dashboard at `/admin` for products, variants, stock, categories, orders, and customer profiles
- PostgreSQL migrations, seed catalog, Row Level Security (RLS) policies, and Supabase Storage rules

## Local setup

1. Install Node.js 20+ and Docker Desktop, then start Docker Desktop.
2. Install dependencies and start the local Supabase services:

   ```sh
   npm install
   npm run db:start
   ```

3. Supabase prints local API credentials after startup. Copy `.env.example` to `.env` and set `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` from `npx supabase status`.
4. If the services were already running before migrations were added, apply the schema and seed data:

   ```sh
   npm run db:reset
   ```

5. Start the app:

   ```sh
   npx expo start
   ```

The local Supabase Studio is at `http://127.0.0.1:54323`. Use Expo Go to open the mobile app. To use the admin page in a desktop browser, run `npm run web` and open `/admin`.

## Create the first admin

1. Create a customer account through the app. For a local database, auth emails can be viewed in the local Inbucket service shown by `npx supabase status`.
2. In Supabase Studio, open SQL Editor and promote that account using its email:

   ```sql
   update public.profiles
   set role = 'admin'
   where user_id = (select id from auth.users where email = 'admin@example.com');
   ```

3. Sign in again and open `/admin` or select **Admin dashboard** from the Account tab.

Never grant admin access from the public sign-up form. Role changes are restricted by RLS and should only be made by a trusted database administrator.

## Deploy the backend

Create a Supabase project, then link and push the versioned schema:

```sh
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npm run db:push
```

Set the project URL and publishable key in your Expo build environment and local `.env`. The publishable key is intended for client apps; keep the Supabase `service_role` key out of the mobile app and admin UI. RLS is the security boundary for client access. Configure production email confirmation/SMTP, auth redirect URLs, database backups, and monitoring in Supabase before launch.

The admin dashboard can upload product images to the public `product-images` bucket or save an image URL. Customers can read active catalog data; only admins can write catalog and storage records.

## Build Android and iOS

Use EAS Build for signed app binaries:

```sh
npx eas-cli@latest build:configure
npx eas-cli@latest build --platform android
npx eas-cli@latest build --platform ios
```

Store releases need Google Play and Apple Developer signing credentials. EAS builds in the cloud, so local Xcode is not required for iOS.

## Operational notes

- Product stock starts at zero and must be set in Admin before a product can be ordered.
- Products with selectable options can be managed using option lines in the admin product form: `Option name | price | stock | SKU`.
- The seeded products and catalog imagery came from publicly visible website content. Verify descriptions, prices, product rights, stock, dispatch rules, privacy policy, and terms before selling.
- COD is the only enabled payment method. No online payment processing is configured.
- This project does not connect to an existing Giriraja production database, order system, inventory provider, or customer CRM. It starts with a separate database that the store owner must operate and maintain.
