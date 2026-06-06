const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  await prisma.settings.upsert({
    where: { id: "default" },
    update: {},
    create: {
      id: "default",
      orgName: "Our Organization",
      brandPrimaryColor: "#2563eb",
    },
  });

  const defaultDomains = [
    "signupgenius.com",
    "www.signupgenius.com",
    "eventbrite.com",
    "www.eventbrite.com",
    "breezechms.com",
    "forms.gle",
    "docs.google.com",
  ];

  for (const domain of defaultDomains) {
    await prisma.allowedDomain.upsert({
      where: { domain },
      update: {},
      create: { domain },
    });
  }
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
