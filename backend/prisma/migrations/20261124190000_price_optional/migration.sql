-- AlterTable: el precio pasa a ser opcional. Las filas existentes conservan su valor.
ALTER TABLE "Bike" ALTER COLUMN "price" DROP NOT NULL;
