# Candy Smoke Shop website

Static site (`index.html`, `assets/`) plus two small server functions (`functions/api/`) that connect the online shop to Lightspeed Retail (X-Series).

## How ordering works

1. `/api/products` reads products and stock for the shop's outlet from Lightspeed, so the website always shows what's on the shelf. Results are cached for 2 minutes.
2. A customer fills their cart and places a curbside order. `/api/orders` re-checks prices and stock on the server, then creates a **parked sale** in Lightspeed tagged *pickup*. The note on the sale holds the customer's name, phone, vehicle and ETA.
3. Staff open the parked sale on the register, check ID, take payment and complete it. Inventory, sales KPIs and compliance records all stay in Lightspeed, the same as a walk-in sale.

Payment happens at pickup. No card data touches the website.

Until Lightspeed is connected, the site runs in **preview mode** with sample products, and orders are not sent anywhere.

## Hosting (Cloudflare Pages)

GitHub Pages can't run the server functions, so this site is set up for Cloudflare Pages (free tier is fine):

1. Cloudflare dashboard → Workers & Pages → Create → Pages → Connect to Git → pick this repo.
2. Build command: *(none)*. Output directory: `/`.
3. Add the environment variables below under Settings → Environment variables, then redeploy.
4. Point your domain at the Pages project (Custom domains tab).

## Connecting Lightspeed

1. In Lightspeed, go to **Setup → Personal tokens** and create a token. This needs an admin login, and Lightspeed only offers personal tokens on certain plans.
2. Note your **domain prefix**: the part before `.retail.lightspeed.app` in the address bar when you're logged in.
3. Look up your store's IDs:
   ```sh
   LS_DOMAIN_PREFIX=yourprefix LS_TOKEN=yourtoken node scripts/lightspeed-ids.mjs
   ```
4. Set these in Cloudflare (mark `LS_TOKEN` as a **Secret**):

| Variable | What it is |
|---|---|
| `LS_DOMAIN_PREFIX` | Your Lightspeed domain prefix |
| `LS_TOKEN` | Personal access token |
| `LS_OUTLET_ID` | The 39th St outlet; stock is read from here |
| `LS_REGISTER_ID` | Register that web orders are parked on |
| `LS_USER_ID` | Staff user web orders are filed under (create a "Website" user if you like) |
| `LS_TAX_ID` | Sales tax applied to web orders |
| `SHOP_HIDDEN_CATEGORIES` | Optional. Comma-separated categories to keep off the website |
| `SHOP_MIN_STOCK` | Optional. Hide items with less stock than this (default 1) |
| `ORDER_NOTIFY_WEBHOOK` | Optional. Slack/Discord webhook to ping staff on new orders |

Product photos come from the images on each product in Lightspeed.

## Local testing

```sh
cp .dev.vars.example .dev.vars   # fill in, or leave LS_TOKEN blank for preview mode
npx wrangler pages dev .
```
