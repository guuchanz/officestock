# 📦 Office Stock — ระบบจัดการสต็อกอุปกรณ์สำนักงาน

ระบบ Web Application สำหรับติดตามการเข้า/ออกของอุปกรณ์ IT สำนักงาน  
สร้างด้วย **Next.js 15 (App Router)** + **MySQL** + **Prisma** + **Tailwind CSS**

---

## ⚙️ Tech Stack

| Layer | Tech |
|---|---|
| Framework | Next.js 15 (App Router + Server Actions) |
| Database | MySQL |
| ORM | Prisma |
| Auth | NextAuth.js v5 (Credentials) |
| UI | Tailwind CSS + Radix UI primitives |
| Validation | Zod |
| Forms | React Hook Form + useActionState |

---

## 🚀 การติดตั้ง (Setup)

### 1. Clone และติดตั้ง dependencies

```bash
git clone <repo-url>
cd office-stock-app
npm install
```

### 2. ตั้งค่า Environment Variables

```bash
cp .env.example .env
```

แก้ไข `.env`:

```env
DATABASE_URL="mysql://root:yourpassword@localhost:3306/office_stock_db"
AUTH_SECRET="generate-with: openssl rand -base64 32"
AUTH_URL="http://localhost:3000"
```

### 3. สร้างฐานข้อมูลและ migrate

```bash
# สร้าง database ใน MySQL ก่อน
mysql -u root -p -e "CREATE DATABASE office_stock_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

# Migrate schema
npm run db:migrate

# ใส่ข้อมูลตัวอย่าง
npm run db:seed
```

### 4. รัน Development Server

```bash
npm run dev
```

เปิดเบราว์เซอร์ที่ [http://localhost:3000](http://localhost:3000)

---

## 👤 Demo Credentials

| Role | Email | Password |
|---|---|---|
| Admin | admin@company.com | admin1234 |
| Staff | staff@company.com | staff1234 |

> ⚠️ **Production**: เปลี่ยนไปใช้ `bcrypt` สำหรับ hash password ใน `src/lib/auth.ts`

---

## 📁 โครงสร้างโปรเจกต์

```
src/
├── actions/            # Server Actions (stock, product)
├── app/
│   ├── (dashboard)/    # Protected pages (layout + sidebar)
│   │   ├── dashboard/  # หน้าภาพรวม + ตารางสต็อก
│   │   ├── products/   # รายการสินค้า + เพิ่มสินค้า
│   │   └── transactions/ # ประวัติรายการ
│   ├── login/          # หน้า Login
│   └── api/auth/       # NextAuth handler
├── components/
│   ├── layout/         # Sidebar, Header
│   ├── dashboard/      # MetricCard, StockTable
│   └── stock/          # StockModal (In/Out)
├── lib/
│   ├── prisma.ts       # Prisma client singleton
│   └── auth.ts         # NextAuth config
└── types/              # Shared TypeScript types
```

---

## 🔑 ฟีเจอร์หลัก

- ✅ **Dashboard** — สรุปจำนวนสต็อก, สินค้าใกล้หมด, รายการวันนี้
- ✅ **Real-time Search** — ค้นหาสินค้าโดยไม่ต้องกด Enter
- ✅ **Quick Actions** — ปุ่มเบิก/นำเข้าในแต่ละแถวตาราง (ไม่เปลี่ยนหน้า)
- ✅ **Stock Modal** — Pop-up พร้อม +/- ปุ่มปรับจำนวน, เลือกเหตุผล, หมายเหตุ
- ✅ **Atomic Transactions** — อัปเดตสต็อก + บันทึก log ในคำสั่งเดียว (ป้องกัน Race Condition)
- ✅ **Transaction History** — ประวัติย้อนหลังพร้อม color coding (เขียว=IN, แดง=OUT)
- ✅ **Low Stock Alert** — Badge แจ้งเตือนสินค้าต่ำกว่า minStock
- ✅ **Auth** — Login ด้วย Email/Password, ชื่อผู้ทำรายการบันทึกอัตโนมัติ

---

## 🛡️ Security Notes

1. **Race Conditions**: ใช้ `prisma.$transaction()` ป้องกัน concurrent updates
2. **Immutable Logs**: ไม่มี API สำหรับแก้ไข/ลบ StockTransaction
3. **Validation**: Zod validate ทั้ง client + server side
4. **Auth**: Middleware ป้องกันทุก route นอกจาก `/login`

---

## 🔜 Next Steps (Phase 4)

- [ ] เพิ่ม bcrypt สำหรับ hash password
- [ ] Export รายงาน CSV/Excel
- [ ] Email notification เมื่อสต็อกต่ำกว่า minStock
- [ ] QR Code สำหรับแต่ละสินค้า
- [ ] Dockerize สำหรับ deployment
