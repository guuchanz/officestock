-- AlterTable
ALTER TABLE `RepairJob` ADD COLUMN `deviceModel` VARCHAR(191) NULL,
    ADD COLUMN `deviceTypeId` INTEGER NULL,
    ADD COLUMN `expressNo` VARCHAR(191) NULL,
    ADD COLUMN `ownerName` VARCHAR(191) NULL,
    ADD COLUMN `ownerTel` VARCHAR(191) NULL,
    ADD COLUMN `serviceTag` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `DeviceType` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `DeviceType_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `RepairJob` ADD CONSTRAINT `RepairJob_deviceTypeId_fkey` FOREIGN KEY (`deviceTypeId`) REFERENCES `DeviceType`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

