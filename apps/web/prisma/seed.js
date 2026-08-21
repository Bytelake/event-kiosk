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
      newsletterEnabled: true,
      newsletterTitle: "Newsletter",
      newsletterBody: "Stay connected. Sign up for our newsletter.",
      newsletterUrl: "",
      newsletterButtonLabel: "Sign up",
      givingEnabled: true,
      givingTitle: "Give",
      givingBody: "Share your contact information and we will follow up with ways to give.",
      givingSuccessMessage: "Thank you. We will follow up with giving information.",
      givingNotifyEmail: "",
      givingVisitorEmailSubject: "How to give",
      givingVisitorEmailBody:
        "Thank you for your interest in giving. We will follow up with information about how to give.",
      qrScanEnabled: false,
      qrScanTitle: "Scan QR",
      qrScanBody: "Hold a QR code up to the scanner to open the link.",
    },
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
