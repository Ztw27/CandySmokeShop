# Candy Smoke Shop website

Static site (`index.html`, `assets/`) plus small server functions (`functions/api/`) that connect the online shop to **Lightspeed Retail (R-Series)**.

## How ordering works

1. `/api/products` reads items and in-store stock from Lightspeed, so the website shows what's on the shelf. Results are cached for 3 minutes.
2. A customer fills their cart and places a curbside order. `/api/orders` re-checks stock, then creates an **open (unpaid) sale** in Lightspeed. Its reference number holds the order number, the customer's name and their phone number.
3. Staff are pinged in Slack or Discord with the items, vehicle and ETA (if `ORDER_NOTIFY_WEBHOOK` is set).
4. Staff open the sale in Lightspeed, check ID, take payment and complete it. Inventory, KPIs and compliance records update just like a walk-in sale.

No card data touches the website. Until Lightspeed is connected, the site runs in **preview mode** with sample products.

## Setup

R-Series doesn't have personal access tokens. Instead, you register the website as an "API client" and approve it once. After that, the site renews its own access automatically.

### 1. Put the site on Cloudflare Pages
GitHub Pages can't run the server functions.
1. Cloudflare dashboard → Workers & Pages → Create → Pages → Connect to Git → pick this repo. Build command: *(none)*. Output directory: `/`.
2. Workers & Pages → **KV** → Create a namespace (e.g. `candy-lightspeed`).
3. In the Pages project → Settings → **Bindings** → Add → KV namespace. Variable name `LS_KV`, pick the namespace.
4. Note the site address, e.g. `https://candysmokeshop.pages.dev`, or your own domain once it's attached.

### 2. Register the Lightspeed API client
1. Go to https://cloud.lightspeedapp.com/oauth/register.php and sign in with your Lightspeed login.
2. Fill in:
   - **Name:** Candy Smoke Shop Website
   - **Redirect URI:** `https://YOUR-SITE/api/lightspeed/callback` (must be https and exactly match your site address)
   - **Website:** your site address
   - **Public/distributed app:** No
3. You'll get a **Client ID** and **Client Secret**. Most clients are approved automatically; some take 24–48 hours.

### 3. Add settings in Cloudflare
Pages project → Settings → Variables and Secrets:

| Variable | Value |
|---|---|
| `LS_CLIENT_ID` | From step 2 |
| `LS_CLIENT_SECRET` | From step 2 (type: **Secret**) |
| `SETUP_KEY` | A long random phrase you make up (type: **Secret**) |
| `ORDER_NOTIFY_WEBHOOK` | Recommended. Slack/Discord webhook URL |
| `SHOP_HIDDEN_CATEGORIES` | Optional. Comma-separated categories to keep off the site |
| `SHOP_ECOM_ONLY` | Optional. `true` lists only items with "Publish to eCom" ticked |
| `SHOP_MIN_STOCK` | Optional. Default 1 |

Redeploy (Deployments → ⋯ → Retry deployment) so the settings take effect.

### 4. Connect
1. Visit `https://YOUR-SITE/api/lightspeed/connect?key=YOUR_SETUP_KEY`.
2. Log in to Lightspeed as an admin and click **Authorize**. Use the account you want orders recorded under.
3. The page that comes back lists your shop, register and employee IDs. Add `LS_SHOP_ID`, `LS_REGISTER_ID` and `LS_EMPLOYEE_ID` in Cloudflare and redeploy.
4. Check everything at `https://YOUR-SITE/api/lightspeed/status?key=YOUR_SETUP_KEY`.

The connection stays alive as long as the site is used at least once every 30 days. If it ever drops, the status page has a **Reconnect** button.

### 5. Test one order
Place a small test order on the site. Make sure staff can find it in Lightspeed under **Sales** (it's an unpaid, open sale), complete it at the register, and that stock goes down. Then void the test sale.

## Local testing

```sh
cp .dev.vars.example .dev.vars
npx wrangler pages dev . --kv LS_KV
```

Locally the site runs in preview mode. Connecting Lightspeed needs the real https site.
