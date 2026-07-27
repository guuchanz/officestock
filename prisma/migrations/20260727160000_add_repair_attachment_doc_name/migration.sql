-- AlterTable
ALTER TABLE `RepairAttachment` ADD COLUMN `docName` VARCHAR(191) NOT NULL DEFAULT '';


-- Backfill: rows created before this column existed have no label, so fall
-- back to the original filename rather than showing a blank link.
UPDATE `RepairAttachment` SET `docName` = `fileName` WHERE `docName` = '';
