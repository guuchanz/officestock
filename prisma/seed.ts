import { PrismaClient, Role } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  // Seed categories
  const categories = await Promise.all([
    prisma.category.upsert({ where: { name: "เมาส์" }, update: {}, create: { name: "เมาส์" } }),
    prisma.category.upsert({ where: { name: "คีย์บอร์ด" }, update: {}, create: { name: "คีย์บอร์ด" } }),
    prisma.category.upsert({ where: { name: "อุปกรณ์เครือข่าย" }, update: {}, create: { name: "อุปกรณ์เครือข่าย" } }),
    prisma.category.upsert({ where: { name: "สายเคเบิล" }, update: {}, create: { name: "สายเคเบิล" } }),
    prisma.category.upsert({ where: { name: "อื่นๆ" }, update: {}, create: { name: "อื่นๆ" } }),
  ]);

  // Seed departments
  await Promise.all([
    prisma.department.upsert({ where: { name: "ฝ่าย IT" }, update: {}, create: { name: "ฝ่าย IT" } }),
    prisma.department.upsert({ where: { name: "ฝ่ายบัญชี" }, update: {}, create: { name: "ฝ่ายบัญชี" } }),
    prisma.department.upsert({ where: { name: "ฝ่ายทรัพยากรบุคคล" }, update: {}, create: { name: "ฝ่ายทรัพยากรบุคคล" } }),
    prisma.department.upsert({ where: { name: "ฝ่ายขาย" }, update: {}, create: { name: "ฝ่ายขาย" } }),
  ]);

  // Seed admin user
  const admin = await prisma.user.upsert({
    where: { email: "admin@company.com" },
    update: {},
    create: {
      email: "admin@company.com",
      name: "Admin User",
      role: Role.ADMIN,
      password: "admin1234", // In production: hash this with bcrypt
    },
  });

  const staff = await prisma.user.upsert({
    where: { email: "staff@company.com" },
    update: {},
    create: {
      email: "staff@company.com",
      name: "IT Staff",
      role: Role.STAFF,
      password: "staff1234",
    },
  });

  // Seed products
  const products = [
    { code: "MS-001", name: "Logitech MX Master 3", categoryId: categories[0].id, totalStock: 15, minStock: 5, location: "ตู้ A1" },
    { code: "MS-002", name: "Logitech M330", categoryId: categories[0].id, totalStock: 3, minStock: 5, location: "ตู้ A1" },
    { code: "MS-003", name: "Microsoft Arc Mouse", categoryId: categories[0].id, totalStock: 8, minStock: 3, location: "ตู้ A2" },
    { code: "KB-001", name: "Keychron K2 Pro", categoryId: categories[1].id, totalStock: 12, minStock: 5, location: "ตู้ B1" },
    { code: "KB-002", name: "Logitech K380", categoryId: categories[1].id, totalStock: 4, minStock: 5, location: "ตู้ B1" },
    { code: "KB-003", name: "Dell KB216", categoryId: categories[1].id, totalStock: 20, minStock: 8, location: "ตู้ B2" },
    { code: "NW-001", name: "TP-Link TL-SG108", categoryId: categories[2].id, totalStock: 6, minStock: 2, location: "ตู้ C1" },
    { code: "NW-002", name: "USB Ethernet Adapter", categoryId: categories[2].id, totalStock: 2, minStock: 3, location: "ตู้ C1" },
    { code: "CB-001", name: "HDMI Cable 1.8m", categoryId: categories[3].id, totalStock: 30, minStock: 10, location: "ตู้ D1" },
    { code: "CB-002", name: "USB-C to USB-A Cable", categoryId: categories[3].id, totalStock: 1, minStock: 5, location: "ตู้ D1" },
  ];

  for (const p of products) {
    await prisma.product.upsert({
      where: { code: p.code },
      update: {},
      create: p,
    });
  }

  // Seed some transactions
  const createdProducts = await prisma.product.findMany();
  const txData = [
    { productId: createdProducts[0].id, type: "IN" as const, quantity: 20, reason: "ซื้อเติม", operatorId: admin.id },
    { productId: createdProducts[0].id, type: "OUT" as const, quantity: 5, reason: "เบิกใช้งาน", note: "แจก IT Dept", operatorId: staff.id },
    { productId: createdProducts[3].id, type: "IN" as const, quantity: 15, reason: "ซื้อเติม", operatorId: admin.id },
    { productId: createdProducts[3].id, type: "OUT" as const, quantity: 3, reason: "เบิกใช้งาน", operatorId: staff.id },
    { productId: createdProducts[1].id, type: "OUT" as const, quantity: 2, reason: "ของชำรุด", note: "เมาส์เสีย 2 ตัว", operatorId: staff.id },
    { productId: createdProducts[9].id, type: "OUT" as const, quantity: 4, reason: "เบิกใช้งาน", operatorId: staff.id },
  ];

  for (const tx of txData) {
    await prisma.stockTransaction.create({ data: tx });
  }

  console.log("✅ Seed data created successfully");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
