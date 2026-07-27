-- CreateTable
CREATE TABLE `RepairPart` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `repairJobId` INTEGER NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `cost` DECIMAL(10, 2) NOT NULL DEFAULT 0,

    INDEX `RepairPart_repairJobId_idx`(`repairJobId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `RepairPart` ADD CONSTRAINT `RepairPart_repairJobId_fkey` FOREIGN KEY (`repairJobId`) REFERENCES `RepairJob`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;


-- Backfill: jobs recorded before this table existed carry a single partsCost
-- with the parts named only in free text. Convert each into one editable part
-- row so `partsCost = sum(parts)` holds everywhere and the old value is not
-- stranded outside the new UI.
INSERT INTO `RepairPart` (`repairJobId`, `name`, `cost`)
SELECT `id`,
       LEFT(COALESCE(NULLIF(TRIM(`partsUsed`), ''), 'Parts'), 191),
       `partsCost`
FROM `RepairJob`
WHERE `partsCost` > 0;
