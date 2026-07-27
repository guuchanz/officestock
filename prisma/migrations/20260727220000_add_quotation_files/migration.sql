-- AlterTable
ALTER TABLE `Quotation` MODIFY `fileUrl` VARCHAR(191) NULL,
    MODIFY `fileName` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `QuotationFile` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `quotationId` INTEGER NOT NULL,
    `docName` VARCHAR(191) NOT NULL,
    `fileUrl` VARCHAR(191) NOT NULL,
    `fileName` VARCHAR(191) NOT NULL,
    `mimeType` VARCHAR(191) NOT NULL,
    `uploadedById` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `QuotationFile_quotationId_idx`(`quotationId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `QuotationFile` ADD CONSTRAINT `QuotationFile_quotationId_fkey` FOREIGN KEY (`quotationId`) REFERENCES `Quotation`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `QuotationFile` ADD CONSTRAINT `QuotationFile_uploadedById_fkey` FOREIGN KEY (`uploadedById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;


-- Backfill: every existing quotation had exactly one file stored on the row.
-- Move it into a file row so the new multi-file UI shows it, instead of the
-- original PDF disappearing from the page.
INSERT INTO `QuotationFile` (`quotationId`, `docName`, `fileUrl`, `fileName`, `mimeType`, `uploadedById`, `createdAt`)
SELECT `id`, LEFT(`fileName`, 191), `fileUrl`, `fileName`, 'application/pdf', `uploadedById`, `createdAt`
FROM `Quotation`
WHERE `fileUrl` IS NOT NULL AND `fileUrl` <> '';
