# Shop Manager

Next.js inventory app for stock, purchases, sales, and profit calculations.

## Run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Flow

1. **Inventory** — add products (name, SKU, cost, sell price)
2. **Purchases** — receive stock (increases qty, updates cost)
3. **Sales** — sell stock (decreases qty, records revenue / COGS / profit)
4. **Dashboard** — stock value, revenue, profit, low-stock alerts

Data is stored in MongoDB via Mongoose (`MONGO_URI` in `.env`).
