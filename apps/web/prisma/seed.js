const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  await prisma.settings.upsert({
    where: { id: "default" },
    update: {},
    create: { id: "default", orgName: "Our Organization", brandPrimaryColor: "#2563eb" },
  });

  for (const domain of [
    "signupgenius.com",
    "www.signupgenius.com",
    "eventbrite.com",
    "www.eventbrite.com",
    "breezechms.com",
    "forms.gle",
    "docs.google.com",
  ]) {
    await prisma.allowedDomain.upsert({
      where: { domain },
      update: {},
      create: { domain },
    });
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
