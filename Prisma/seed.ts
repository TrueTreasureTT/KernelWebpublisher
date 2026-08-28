import {
  PrismaClient
} from "@prisma/client";

import bcrypt from "bcryptjs";

const prisma =
  new PrismaClient();

async function main() {
  const password =
    await bcrypt.hash(
      "ChangeMe123!",
      12
    );

  await prisma.user.upsert({
    where: {
      email: "admin@example.com"
    },
    update: {},
    create: {
      email: "admin@example.com",
      name: "Admin",
      password
    }
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
