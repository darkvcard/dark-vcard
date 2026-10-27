# vCard

Create a modern e-commerce website named "vCard" for selling Virtual Debit Cards. The domain will be vcard.bond.
Theme: Darkweb, Cyberpunk, Hacker-style. Use a sleek dark background (deep blue/black) with neon yellow and white accents to match the logo.
Logo Concept: The logo features a deep blue stylized 'D' with a hacker figure and a credit card chip, surrounded by stars. Use text "vCARD" with yellow curly braces {vCARD}.
Pages needed:

Landing Page (Hero section with a hacker vibe, "Buy Virtual Cards Anonymously", featured cards, and "Why Choose Us" section).

Shop/Products Page (Grid layout showing available cards).

Footer with Telegram/Discord support links.
Make the UI look premium, dark, and trustworthy, appealing to crypto users.

Set up a Supabase backend for the vCard e-commerce site. Create the following database tables:

users (for authentication).

cards (id, card_name, card_type, price_in_usd, description, stock_status, image_url).

orders (id, user_id, card_id, crypto_method, transaction_hash, wallet_address, status [pending, completed, failed], created_at).

Create an Admin Panel where the admin can:

Login securely.

Add, edit, and delete Virtual Cards (upload images, set prices, update stock).

View all orders and manually approve/verify them if auto-verification fails.

List multiple cards daily as inventory changes.

Create a User Dashboard where users can see their purchased cards and order history.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://dark-vcard.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/29df278c-92f3-401d-a224-b1a7d70ffb39).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
