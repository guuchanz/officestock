/*
  Warnings:

  - You are about to drop the column `departmentId` on the `product` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE `Product` DROP FOREIGN KEY `Product_departmentId_fkey`;

-- AlterTable
ALTER TABLE `Product` DROP COLUMN `departmentId`;

-- AlterTable
ALTER TABLE `StockTransaction` ADD COLUMN `departmentId` INTEGER NULL;

-- AddForeignKey
ALTER TABLE `StockTransaction` ADD CONSTRAINT `StockTransaction_departmentId_fkey` FOREIGN KEY (`departmentId`) REFERENCES `Department`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
