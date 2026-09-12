import { getDb } from "@/lib/db/client";
import { seedSp104 } from "./seed-sp104";
import { PRODUCT_NAME } from "@/lib/product";

seedSp104(getDb()).then(({ seeded }) => {
  console.log(
    seeded
      ? `SP104 seeded into ${PRODUCT_NAME}`
      : "SP104 already present (unchanged)",
  );
  process.exit(0);
});
