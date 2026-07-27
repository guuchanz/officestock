-- AlterTable
ALTER TABLE `MaintenanceLog` ADD COLUMN `labourCost` DECIMAL(10, 2) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE `MaintenancePart` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `logId` INTEGER NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `cost` DECIMAL(10, 2) NOT NULL DEFAULT 0,

    INDEX `MaintenancePart_logId_idx`(`logId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `MaintenancePart` ADD CONSTRAINT `MaintenancePart_logId_fkey` FOREIGN KEY (`logId`) REFERENCES `MaintenanceLog`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;


-- Backfill: existing logs recorded a single total with no part breakdown.
-- Move it to labourCost so the invariant `cost = labourCost + sum(parts)`
-- holds for old rows too, instead of leaving them looking like 0 + nothing.
UPDATE `MaintenanceLog` SET `labourCost` = `cost` WHERE `labourCost` = 0 AND `cost` > 0;
