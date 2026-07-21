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
| UI | Tailwind CSS (plain native form controls — no component library in use) |
| Validation | Zod |
| Forms | `useActionState` + Server Actions (no client form library) |
| Charts | Hand-built responsive SVG line charts (no external chart dependency) |
| Export | ExcelJS (.xlsx) + PDFKit (.pdf) |

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

# ใส่ข้อมูลตัวอย่าง (หมวดหมู่, แผนก, ผู้ใช้ demo, สินค้า, รายการตัวอย่าง)
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
├── actions/                  # Server Actions
│   ├── product.actions.ts    # CRUD สินค้า, หมวดหมู่, ประวัติรายการ
│   ├── stock.actions.ts      # นำเข้า/เบิกออก (atomic transaction), dashboard stats
│   ├── department.actions.ts # CRUD แผนก (master list)
│   └── report.actions.ts     # สรุปต้นทุนรายเดือน + ข้อมูลกราฟรายวัน
├── app/
│   ├── (dashboard)/           # Protected pages (layout + sidebar)
│   │   ├── dashboard/         # ภาพรวม + ตารางสต็อก
│   │   ├── products/          # รายการสินค้า, เพิ่ม/แก้ไขสินค้า ([id]/edit)
│   │   ├── departments/       # จัดการรายชื่อแผนก (เพิ่ม/แก้ไข/ลบ)
│   │   ├── transactions/      # ประวัติรายการเข้า-ออก
│   │   └── reports/           # รายงานต้นทุนรายเดือน + กราฟแนวโน้มรายวัน
│   ├── api/
│   │   ├── auth/[...nextauth]/    # NextAuth handler
│   │   ├── reports/[month]/       # ดาวน์โหลดรายงาน Excel/PDF รายเดือน
│   │   └── transactions/export/   # ดาวน์โหลดประวัติรายการเป็น Excel
│   └── login/                 # หน้า Login
├── components/
│   ├── layout/                # Sidebar, Header
│   ├── dashboard/              # MetricCard, StockTable
│   ├── products/                # ProductForm (ใช้ร่วมกันทั้งเพิ่ม/แก้ไข)
│   ├── departments/             # DepartmentForm, DepartmentRow (แก้ไข/ลบแบบ inline)
│   ├── stock/                   # StockModal (นำเข้า/เบิกออก)
│   ├── transactions/            # TransactionFilters
│   └── reports/                 # LineChart, MonthlyChartsSection
├── lib/
│   ├── prisma.ts               # Prisma client singleton
│   ├── auth.ts                 # NextAuth config
│   └── chart-colors.ts         # Categorical palette สำหรับกราฟ
└── types/                      # Shared TypeScript types
```

---

## 🗄️ Data Model (Prisma)

| Model | หมายเหตุ |
|---|---|
| `User` | ผู้ใช้งาน (ADMIN / STAFF), ผูกกับ NextAuth |
| `Category` | หมวดหมู่สินค้า (master list) |
| `Department` | แผนก (master list) — ผูกกับ `StockTransaction` ไม่ใช่ `Product` |
| `Product` | สินค้า — รหัส, ชื่อ, **รายละเอียด/สเปก**, หมวดหมู่, สต็อก, หน่วย, ราคาต่อหน่วย, รูปภาพ |
| `StockTransaction` | รายการนำเข้า/เบิกออก — จำนวน, เหตุผล, ผู้รับ (OUT), **แผนก**, หมายเหตุ, ผู้ทำรายการ |

> แผนก (Department) ถูกระบุตอนทำรายการนำเข้า/เบิกออก (ใน `StockModal`) ไม่ใช่ตอนเพิ่มสินค้า — สินค้าหนึ่งชิ้นจึงถูกเบิกให้หลายแผนกต่างกันได้ในแต่ละรายการ

---

## 🔑 ฟีเจอร์หลัก

- ✅ **Dashboard** — สรุปจำนวนสต็อก, สินค้าใกล้หมด, รายการวันนี้
- ✅ **Real-time Search** — ค้นหาสินค้าโดยไม่ต้องกด Enter
- ✅ **Quick Actions** — ปุ่มเบิก/นำเข้าในแต่ละแถวตาราง (ไม่เปลี่ยนหน้า)
- ✅ **Stock Modal** — Pop-up พร้อม +/- ปุ่มปรับจำนวน, เลือกเหตุผล, เลือกแผนก, ผู้รับ (กรณีเบิก), หมายเหตุ
- ✅ **Atomic Transactions** — อัปเดตสต็อก + บันทึก log ในคำสั่งเดียว (ป้องกัน Race Condition)
- ✅ **Transaction History** — ประวัติย้อนหลังพร้อม color coding (เขียว=IN, แดง=OUT), filter ตามคำค้น/ช่วงวันที่, export Excel
- ✅ **Low Stock Alert** — Badge แจ้งเตือนสินค้าต่ำกว่า minStock
- ✅ **สินค้า** — รูปภาพ, ราคาต่อหน่วย, หน่วยนับ, รายละเอียด/สเปก, แก้ไขได้ทุกฟิลด์
- ✅ **แผนก (Department)** — จัดการรายชื่อแผนกแบบ CRUD เต็มรูปแบบ (เพิ่ม/แก้ไข inline/ลบ), เลือกใช้ตอนทำรายการนำเข้า-เบิกออก
- ✅ **รายงานต้นทุน** — สรุปมูลค่านำเข้า/เบิกออกรายเดือน, ดาวน์โหลด Excel/PDF ต่อเดือน
- ✅ **กราฟแนวโน้มรายวัน** — เลือกเดือนดูกราฟเส้น 2 กราฟแบบ responsive: รายการตามแผนกต่อวัน และ 5 อันดับสินค้าเบิกออกมากที่สุด (มี tooltip, crosshair, legend)
- ✅ **Auth** — Login ด้วย Email/Password, ชื่อผู้ทำรายการบันทึกอัตโนมัติ

---

## 🛡️ Security Notes

1. **Race Conditions**: ใช้ `prisma.$transaction()` ป้องกัน concurrent updates
2. **Immutable Logs**: ไม่มี API สำหรับแก้ไข/ลบ StockTransaction
3. **Validation**: Zod validate ทั้ง client + server side
4. **Auth**: Middleware ป้องกันทุก route นอกจาก `/login`

---

## 🔜 Next Steps

- [ ] เพิ่ม bcrypt สำหรับ hash password
- [ ] Email notification เมื่อสต็อกต่ำกว่า minStock
- [ ] QR Code สำหรับแต่ละสินค้า
- [ ] Dockerize สำหรับ deployment
