import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const [txCount, productCount] = await Promise.all([
    prisma.stockTransaction.count(),
    prisma.product.count(),
  ]);

  console.log(`About to delete ${txCount} stock transactions and reset totalStock on ${productCount} products.`);

  await prisma.$transaction([
    prisma.stockTransaction.deleteMany(),
    prisma.product.updateMany({ data: { totalStock: 0 } }),
  ]);

  console.log("✅ Stock transactions cleared and product quantities reset to 0.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
