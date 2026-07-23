# 📦 Office Stock — ระบบจัดการสต็อกอุปกรณ์สำนักงาน

ระบบ Web Application สำหรับติดตามการเข้า/ออกของอุปกรณ์ IT สำนักงาน  
สร้างด้วย **Next.js 15 (App Router)** + **MySQL** + **Prisma** + **Tailwind CSS**  
รองรับ 2 ภาษา (ไทย/อังกฤษ) แบบสลับได้ทันที

---

## ⚙️ Tech Stack

| Layer | Tech |
|---|---|
| Framework | Next.js 15 (App Router + Server Actions) |
| Database | MySQL |
| ORM | Prisma |
| Auth | NextAuth.js v5 (Credentials) + bcrypt password hashing |
| i18n | next-intl (ไทย / English, สลับได้จาก Sidebar, จำค่าไว้ด้วย cookie) |
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

รันจาก `npm run db:seed` — รหัสผ่านถูก hash ด้วย bcrypt ก่อนบันทึกลงฐานข้อมูลจริง

| Role | Email | Password |
|---|---|---|
| Admin | admin@company.com | admin1234 |
| Staff | staff@company.com | staff1234 |

> ผู้ใช้ทุกคนที่สร้างผ่านหน้า **ผู้ใช้งาน** (`/users`, Admin/Moderator เท่านั้น) จะถูกบังคับให้เปลี่ยนรหัสผ่านในการเข้าสู่ระบบครั้งแรก (redirect ไป `/reset-password` โดยอัตโนมัติ) — บัญชี demo ด้านบนถูก seed มาโดยไม่ติดเงื่อนไขนี้

**Roles ที่มีในระบบ**: `ADMIN` (จัดการทุกอย่างรวมถึงผู้ใช้งาน), `MODERATOR` (เพิ่มผู้ใช้งานใหม่ได้ แต่แก้ไข/รีเซ็ตรหัสผ่าน/ลบไม่ได้ และสร้างได้แค่ role Staff), `STAFF` (ใช้งานทั่วไป ไม่เห็นเมนูผู้ใช้งาน)

---

## 🔄 รีเซ็ตข้อมูล (Reset Data)

| คำสั่ง | ผลลัพธ์ |
|---|---|
| `npm run db:reset-stock` | ลบรายการนำเข้า/เบิกออกทั้งหมด (`StockTransaction`) และตั้ง `totalStock` ของทุกสินค้ากลับเป็น 0 — **ไม่แตะ** ผู้ใช้งาน/หมวดหมู่/แผนก/สินค้า/ใบเสนอราคา เหมาะกับตอนอยากเริ่มนับสต็อกใหม่ก่อนขึ้นใช้งานจริง โดยไม่เสียข้อมูล master ที่ตั้งค่าไว้แล้ว |
| `npm run db:seed` | รันซ้ำได้ (`upsert`) — เพิ่ม/อัปเดตข้อมูลตัวอย่างเดิม ไม่ลบข้อมูลที่มีอยู่ |
| `npx prisma migrate reset` | ⚠️ ล้างฐานข้อมูลทั้งหมดทุกตาราง แล้ว migrate ใหม่ + รัน seed อัตโนมัติ ใช้เฉพาะตอนต้องการเริ่มต้นใหม่ทั้งหมดจริงๆ เพราะลบทุกอย่างรวมถึงผู้ใช้งาน/สินค้า/รายการที่สร้างเองด้วย |

> การลบสินค้ารายตัวจากหน้า **สินค้า** เป็น soft delete (ตั้ง `isActive = false`) ไม่ใช่ลบแถวออกจากฐานข้อมูลจริง เพราะ `Product` ถูกอ้างอิงโดย `StockTransaction` ผ่าน foreign key — ถ้ามีประวัติรายการอยู่ การลบแถวจริงจะ error (`P2003`) เสมอ สินค้าที่ถูกลบจะหายไปจากรายการ/หน้าค้นหา แต่ประวัติ transaction เดิมยังอยู่ครบ

---

## 📁 โครงสร้างโปรเจกต์

```
src/
├── actions/                     # Server Actions
│   ├── product.actions.ts       # CRUD สินค้า (รวม Lot No.), ค้นหา, ประวัติรายการ
│   ├── category.actions.ts      # CRUD หมวดหมู่สินค้า (master list)
│   ├── department.actions.ts    # CRUD แผนก (master list)
│   ├── stock.actions.ts         # นำเข้า/เบิกออก (atomic transaction), dashboard stats
│   ├── report.actions.ts        # สรุปต้นทุนรายเดือน/รายปี + ข้อมูลกราฟรายวัน
│   ├── quotation.actions.ts     # CRUD ใบเสนอราคา + อัปโหลด/แทนที่ไฟล์ PDF
│   ├── user.actions.ts          # CRUD ผู้ใช้งาน, รีเซ็ตรหัสผ่าน (Admin/Moderator)
│   └── locale.actions.ts        # สลับภาษา (เขียน cookie)
├── app/
│   ├── (dashboard)/              # Protected pages (layout + sidebar)
│   │   ├── dashboard/             # ภาพรวม + ตารางสต็อก
│   │   ├── products/              # รายการสินค้า, เพิ่ม/แก้ไขสินค้า ([id]/edit)
│   │   ├── categories/            # จัดการหมวดหมู่สินค้า (เพิ่ม/แก้ไข/ลบ)
│   │   ├── departments/           # จัดการรายชื่อแผนก (เพิ่ม/แก้ไข/ลบ)
│   │   ├── transactions/          # ประวัติรายการเข้า-ออก + filter/search
│   │   ├── reports/               # รายงานต้นทุนรายเดือน/รายปี + กราฟแนวโน้มรายวัน
│   │   ├── quotations/            # รายการใบเสนอราคา, อัปโหลด/แก้ไข ([id]/edit)
│   │   └── users/                 # จัดการผู้ใช้งาน (Admin/Moderator เท่านั้น)
│   ├── api/
│   │   ├── auth/[...nextauth]/    # NextAuth handler
│   │   ├── reports/[month]/       # ดาวน์โหลดรายงาน Excel/PDF รายเดือน
│   │   ├── reports/year/[year]/   # ดาวน์โหลดรายงาน Excel/PDF รายปี
│   │   └── transactions/export/   # ดาวน์โหลดประวัติรายการเป็น Excel
│   ├── uploads/[...path]/         # serve ไฟล์อัปโหลดจาก UPLOAD_DIR (อ่าน disk ทุก request + ตรวจ auth)
│   ├── login/                     # หน้า Login
│   └── reset-password/            # บังคับเปลี่ยนรหัสผ่านครั้งแรก (ผู้ใช้ที่ถูก admin สร้าง/รีเซ็ต)
├── components/
│   ├── layout/                   # Sidebar, Header, LanguageSwitcher
│   ├── dashboard/                  # MetricCard, StockTable
│   ├── products/                    # ProductForm (ใช้ร่วมกันทั้งเพิ่ม/แก้ไข)
│   ├── categories/                  # CategoryForm, CategoryRow (แก้ไข/ลบแบบ inline)
│   ├── departments/                 # DepartmentForm, DepartmentRow (แก้ไข/ลบแบบ inline)
│   ├── stock/                       # StockModal (นำเข้า/เบิกออก)
│   ├── transactions/                # TransactionFilters
│   ├── reports/                     # LineChart, MonthlyChartsSection, ReportsOverview
│   ├── quotations/                  # QuotationForm, QuotationRow, QuotationFilters
│   ├── users/                       # UserForm, UserRow
│   └── auth/                        # ResetPasswordForm
├── i18n/                      # next-intl config (locale resolution จาก cookie)
├── lib/
│   ├── prisma.ts               # Prisma client singleton
│   ├── auth.ts                 # NextAuth config เต็มรูปแบบ (Credentials + bcrypt) — ใช้ใน Server Components/Actions เท่านั้น
│   ├── auth.config.ts          # NextAuth config แบบ edge-safe (ไม่มี provider) — ใช้ใน middleware
│   ├── reportExport.ts         # ตัวสร้างไฟล์ Excel/PDF ที่ใช้ร่วมกันระหว่างรายงานรายเดือน/รายปี
│   ├── uploads.ts              # ที่เก็บไฟล์อัปโหลด (UPLOAD_DIR), บันทึกไฟล์, กัน path traversal
│   └── chart-colors.ts         # Categorical palette สำหรับกราฟ
└── types/                      # Shared TypeScript types

messages/               # ไฟล์แปลภาษา ไทย (th.json) / อังกฤษ (en.json)
```

---

## 🗄️ Data Model (Prisma)

| Model | หมายเหตุ |
|---|---|
| `User` | ผู้ใช้งาน — role `ADMIN` / `MODERATOR` / `STAFF`, รหัสผ่านเก็บแบบ bcrypt hash, มี `mustResetPassword` สำหรับบังคับเปลี่ยนรหัสผ่านครั้งแรก |
| `Category` | หมวดหมู่สินค้า (master list) — จัดการแบบ CRUD เต็มรูปแบบที่ `/categories` |
| `Department` | แผนก (master list) — ผูกกับ `StockTransaction` ไม่ใช่ `Product` |
| `Product` | สินค้า — รหัส, **Lot No.**, ชื่อ, รายละเอียด/สเปก, หมวดหมู่, สต็อก, หน่วย, ราคาต่อหน่วย, รูปภาพ, `isActive` (soft delete — ปุ่มลบตั้งค่านี้เป็น `false` แทนการลบแถวจริง) |
| `StockTransaction` | รายการนำเข้า/เบิกออก — จำนวน, เหตุผล, ผู้รับ (OUT), แผนก, หมายเหตุ, ผู้ทำรายการ |
| `Quotation` | ใบเสนอราคา — เลขที่ QT, ผู้ขาย, รายละเอียด, วันที่สั่งซื้อ/รับของ, มูลค่ารวม, ไฟล์ PDF ที่แนบ, ผู้อัปโหลด |

> แผนก (Department) ถูกระบุตอนทำรายการนำเข้า/เบิกออก (ใน `StockModal`) ไม่ใช่ตอนเพิ่มสินค้า — สินค้าหนึ่งชิ้นจึงถูกเบิกให้หลายแผนกต่างกันได้ในแต่ละรายการ

---

## 🔑 ฟีเจอร์หลัก

- ✅ **Dashboard** — สรุปจำนวนสต็อก, สินค้าใกล้หมด, รายการวันนี้
- ✅ **Real-time Search** — ค้นหาสินค้าโดยไม่ต้องกด Enter (ค้นหาได้ทั้งชื่อ, รหัส, Lot No., หมวดหมู่)
- ✅ **Quick Actions** — ปุ่มเบิก/นำเข้าในแต่ละแถวตาราง (ไม่เปลี่ยนหน้า)
- ✅ **Stock Modal** — Pop-up พร้อม +/- ปุ่มปรับจำนวน, เลือกเหตุผล, เลือกแผนก, ผู้รับ (กรณีเบิก), หมายเหตุ
- ✅ **Atomic Transactions** — อัปเดตสต็อก + บันทึก log ในคำสั่งเดียว (ป้องกัน Race Condition)
- ✅ **Transaction History** — ประวัติย้อนหลังพร้อม color coding (เขียว=IN, แดง=OUT), filter ตามคำค้น/ช่วงวันที่, export Excel
- ✅ **Low Stock Alert** — Badge แจ้งเตือนสินค้าต่ำกว่า minStock
- ✅ **สินค้า** — รูปภาพ, Lot No., ราคาต่อหน่วย, หน่วยนับ, รายละเอียด/สเปก, แก้ไขได้ทุกฟิลด์, ลบได้แบบ soft delete (ซ่อนจากรายการ ประวัติ transaction ยังอยู่ครบ — ดู [Reset Data](#-รีเซ็ตข้อมูล-reset-data))
- ✅ **หมวดหมู่สินค้า (Category)** — จัดการแบบ CRUD เต็มรูปแบบ (เพิ่ม/แก้ไข inline/ลบ), ป้องกันการลบหมวดหมู่ที่ยังมีสินค้าอยู่
- ✅ **แผนก (Department)** — จัดการรายชื่อแผนกแบบ CRUD เต็มรูปแบบ (เพิ่ม/แก้ไข inline/ลบ), เลือกใช้ตอนทำรายการนำเข้า-เบิกออก
- ✅ **ใบเสนอราคา (Quotation)** — อัปโหลดไฟล์ PDF พร้อมเลขที่ QT, ผู้ขาย, วันที่สั่งซื้อ/รับของ, มูลค่ารวม; แก้ไข/ลบ; ค้นหาและ filter ตามช่วงวันที่
- ✅ **รายงานต้นทุน** — สรุปมูลค่านำเข้า/เบิกออกรายเดือนและรายปี, การ์ดสรุปเปลี่ยนตามเดือนที่เลือก, ดาวน์โหลด Excel/PDF ต่อเดือนหรือต่อปี
- ✅ **กราฟแนวโน้มรายวัน** — เลือกเดือนดูกราฟเส้น 2 กราฟแบบ responsive: รายการตามแผนกต่อวัน และ 5 อันดับสินค้าเบิกออกมากที่สุด (มี tooltip, crosshair, legend คลิกเพื่อซ่อน/แสดงเส้นได้)
- ✅ **จัดการผู้ใช้งาน** — CRUD ผู้ใช้งานสำหรับ Admin (Moderator เพิ่มได้เฉพาะ Staff), บังคับเปลี่ยนรหัสผ่านเมื่อเข้าระบบครั้งแรก, รีเซ็ตรหัสผ่านโดย Admin
- ✅ **หลายภาษา (TH/EN)** — สลับภาษาได้จาก Sidebar ทุกหน้า จำค่าไว้ด้วย cookie
- ✅ **Auth** — Login ด้วย Email/Password (bcrypt), ชื่อผู้ทำรายการบันทึกอัตโนมัติ

---

## 🛡️ Security Notes

1. **Password Hashing**: รหัสผ่านทุกบัญชี hash ด้วย `bcrypt` ก่อนบันทึก ไม่มีการเก็บ plaintext
2. **Race Conditions**: ใช้ `prisma.$transaction()` ป้องกัน concurrent updates
3. **Immutable Logs**: ไม่มี API สำหรับแก้ไข/ลบ StockTransaction
4. **Validation**: Zod validate ทั้ง client + server side, ข้อความ error แปลได้ตามภาษาที่เลือก
5. **Auth**: Middleware ป้องกันทุก route นอกจาก `/login`, บังคับ `/reset-password` เมื่อ `mustResetPassword` เป็น true
6. **Role-based access**: ทุก Server Action ที่เกี่ยวกับผู้ใช้งานตรวจสอบ role ฝั่ง server (ไม่ใช่แค่ซ่อน UI) — Moderator ไม่สามารถแก้ไข/รีเซ็ตรหัสผ่าน/ลบผู้ใช้งานได้แม้จะเรียก action ตรงๆ
7. **Edge-safe middleware**: `src/lib/auth.ts` (มี bcrypt + Prisma) ใช้เฉพาะใน Server Components/Actions เท่านั้น ส่วน `middleware.ts` ใช้ `src/lib/auth.config.ts` ที่ไม่มี provider เพื่อให้รันได้ใน Edge Runtime
8. **ไฟล์อัปโหลด**: เก็บนอก `public/` และ serve ผ่าน route handler ที่ตรวจสอบ session ก่อนทุกครั้ง — ผู้ที่ไม่ได้ล็อกอินเข้าถึงรูปสินค้า/PDF ใบเสนอราคาไม่ได้ (ได้ `401`), ชื่อไฟล์ถูกสุ่มเป็น UUID และ path ถูกตรวจกัน directory traversal

---

## 🚢 Deploy สู่ Production

### ขั้นตอนการรัน (ทำตามลำดับ)

```bash
git pull
npm ci                        # ติดตั้งแบบตรงกับ package-lock.json
npx prisma generate           # สร้าง Prisma Client (ไม่มี postinstall script ในโปรเจกต์นี้)
npx prisma migrate deploy     # apply migration กับฐานข้อมูล production (ห้ามใช้ migrate dev)
npm run build                 # ⚠️ ต้องสำเร็จก่อนเสมอ — ดูหมายเหตุด้านล่าง
npm run start                 # รัน Node.js server จริงบน port 3000
```

> **`npm run build` ต้องผ่านก่อนเสมอ** — `next start` ไม่ได้ build อะไรเลย มันแค่อ่านผลลัพธ์ที่ `next build` สร้างไว้ในโฟลเดอร์ `.next/`
> ถ้า build ล้มเหลวแล้วข้ามไปรัน `npm run start` จะเจอ error:
> `Could not find a production build in the '.next' directory`
> ให้ย้อนไปดู output ของ `npm run build` ว่ามี `Error:` อะไร — error ตอน start เป็นแค่ปลายเหตุ
>
> build ที่สำเร็จจะจบด้วยตารางรายการ route (มี `ƒ /uploads/[...path]` อยู่ด้วย)

### ⚠️ โฟลเดอร์ `.next/` ไม่ได้อยู่ใน git

`.next/` คือผลลัพธ์จากการ build ถูก gitignore ไว้ — **ทุกเครื่องต้อง `npm run build` เอง**

และ **ห้ามรัน `npm run dev` บนเครื่อง production** เพราะ `next dev` จะเขียนทับ `.next/` ด้วยไฟล์แบบ development ซึ่งไม่มี production build อยู่ข้างใน ทำให้ `npm run start` พังด้วย error เดียวกันข้างบน — ถ้าเผลอรันไปแล้วให้ลบ `.next/` ทิ้งแล้ว build ใหม่:

```bash
rm -rf .next && npm run build      # Windows: rmdir /s /q .next
```

### Environment Variables

`.env` ถูก gitignore ไว้ — **ไม่ได้ติดมากับ `git pull`** ต้องสร้างเองบนเครื่อง production (คัดลอกจาก `.env.example`)

| ตัวแปร | หมายเหตุ |
|---|---|
| `DATABASE_URL` | ชี้ไปที่ MySQL production |
| `AUTH_SECRET` | generate ด้วย `openssl rand -base64 32` — ถ้าเปลี่ยนค่า session ที่ล็อกอินค้างไว้ทั้งหมดจะหลุด |
| `AUTH_URL` / `NEXTAUTH_URL` | โดเมนจริง เช่น `https://your-domain.com` |
| `UPLOAD_DIR` | โฟลเดอร์เก็บไฟล์อัปโหลด (ดูหัวข้อถัดไป) — ถ้าไม่ตั้งจะใช้ `./var/uploads` |

### 📁 ไฟล์อัปโหลด (รูปสินค้า / PDF ใบเสนอราคา)

ไฟล์อัปโหลด **ห้ามเก็บไว้ใน `public/`** เพราะ `next start` จะอ่านรายชื่อไฟล์ใน `public/` แค่ครั้งเดียวตอน server เริ่มทำงานแล้ว cache ไว้ ไฟล์ที่อัปโหลดเข้ามาทีหลังจะไม่ถูก serve จนกว่าจะ restart — จะเจอ error:

```
⨯ The requested resource isn't a valid image for /uploads/products/xxx.png
  received text/html; charset=utf-8
```

(บน `npm run dev` จะไม่เจอปัญหานี้ เพราะ dev อ่าน filesystem ใหม่ทุก request — เป็นเหตุผลที่ bug นี้มักโผล่เฉพาะตอนขึ้น production)

ระบบจึงเก็บไฟล์ไว้ที่ `UPLOAD_DIR` (นอก `public/`) แล้ว serve ผ่าน route handler `src/app/uploads/[...path]/route.ts` ซึ่งอ่านไฟล์จาก disk ใหม่ทุก request, ตรวจสอบ auth, และกัน path traversal — URL ที่ใช้ยังเป็น `/uploads/...` เหมือนเดิม ค่าที่เก็บในฐานข้อมูลจึงไม่ต้องแก้

**ตั้ง `UPLOAD_DIR` เป็น path ถาวรนอกโฟลเดอร์โปรเจกต์** เพื่อไม่ให้ไฟล์ผู้ใช้หายตอน deploy ใหม่หรือ clone ใหม่:

```env
UPLOAD_DIR="/var/lib/officestock/uploads"     # Windows: UPLOAD_DIR="D:\ITStockData\uploads"
```

ถ้าย้ายมาจากเวอร์ชันเก่าที่เก็บใน `public/uploads/` ให้คัดลอกไฟล์เดิมไปไว้ใน `UPLOAD_DIR` โดยคงโครงสร้างโฟลเดอร์ย่อย `products/` และ `quotations/` ไว้

### สิ่งที่ต้องแก้ก่อน build จริงเสมอ

`next.config.ts`:

```ts
serverActions: {
  allowedOrigins: ["localhost:3000"],   // ต้องเพิ่ม domain จริงก่อน deploy
  bodySizeLimit: "10mb",                // ต้อง ≥ ขนาดไฟล์ที่อนุญาต (PDF จำกัดไว้ 10MB)
```

- ทุกฟอร์มในระบบนี้เป็น Server Action — ถ้าไม่เพิ่ม domain จริงใน `allowedOrigins` การ submit ทุกฟอร์มจะถูกปฏิเสธใน production
- `bodySizeLimit` ต้องไม่ต่ำกว่าขนาดไฟล์ที่ระบบอนุญาต ถ้าตั้งต่ำเกิน (เช่น `1mb`) ไฟล์จะถูกปฏิเสธตั้งแต่ก่อนเข้า validation ของแอป — รูปจากมือถือมักเกิน 1MB

### ข้อจำกัดของ hosting

ระบบนี้ต้องรันบน Node.js server ที่มี persistent disk (VPS/Docker) ไม่เหมาะกับ serverless/edge platform (เช่น Vercel) โดยไม่ปรับโค้ดเพิ่ม เพราะ:
- `bcrypt` เป็น native addon ต้องการ Node.js runtime จริง (ถ้า `npm ci` fail บน Windows ด้วย error เกี่ยวกับ `node-gyp`/`MSBuild` ให้ติดตั้ง build tools หรือเปลี่ยนไปใช้ `bcryptjs`)
- ไฟล์อัปโหลดเขียนลง disk ที่ `UPLOAD_DIR` — serverless/edge มักมี filesystem แบบ ephemeral ที่ข้อมูลจะหายเมื่อ deploy ใหม่ และถ้ารันหลาย instance ไฟล์จะไม่ sync กัน (ดู Next Steps เรื่อง object storage)

---

## 🔜 Next Steps

- [ ] Dockerize สำหรับ deployment (Dockerfile + docker-compose สำหรับ app + MySQL) — อย่าลืม mount `UPLOAD_DIR` เป็น volume
- [ ] ย้ายไฟล์อัปโหลดไป object storage (เช่น S3-compatible / MinIO) เพื่อรองรับ multi-instance/serverless — แก้ที่ `saveUpload()` ใน `src/lib/uploads.ts` จุดเดียว ส่วนอื่นของแอปไม่ต้องแก้
- [ ] Email notification เมื่อสต็อกต่ำกว่า minStock
- [ ] QR Code สำหรับแต่ละสินค้า
