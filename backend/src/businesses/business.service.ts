import type { Prisma } from "@prisma/client";
import type { BusinessSummary } from "@edi/shared-types";
import type { CreateBusinessInput, CreateLocationInput } from "@edi/validation";
import { prisma } from "../db.js";

const defaultModules = [
  "products", "categories", "brands", "customers", "suppliers", "sales", "purchases",
  "inventory", "warehouse", "expenses", "payments", "pos", "reports"
];

export const businessPermissionKeys = [
  "business.view", "business.edit", "business.locations.manage", "business.members.manage",
  "products.view", "products.create", "products.edit", "products.delete",
  "sales.view", "sales.create", "sales.cancel",
  "inventory.view", "inventory.adjust",
  "purchases.view", "purchases.create",
  "customers.view", "customers.edit",
  "suppliers.view", "suppliers.edit",
  "reports.view", "expenses.view", "expenses.create", "discount.approve"
] as const;

export type BusinessContextRecord = {
  business: {
    id: string;
    name: string;
    slug: string;
    type: BusinessSummary["type"];
    features: Array<{ key: string }>;
  };
  role: string;
  permissions: string[];
};

function featureFlags(value: Prisma.JsonValue | undefined): Record<string, boolean> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, boolean] => typeof entry[1] === "boolean")
  );
}

export async function listUserBusinesses(userId: string): Promise<BusinessSummary[]> {
  const now = new Date();
  const memberships = await prisma.businessMembership.findMany({
    where: {
      userId,
      status: "ACTIVE",
      user: { status: "ACTIVE" },
      business: {
        status: "ACTIVE",
        subscriptions: {
          some: {
            status: { in: ["ACTIVE", "TRIAL"] },
            OR: [{ endsAt: null }, { endsAt: { gt: now } }]
          }
        }
      }
    },
    select: {
      role: { select: { name: true } },
      business: {
        select: {
          id: true,
          name: true,
          slug: true,
          type: true,
          features: { where: { enabled: true }, select: { key: true } },
          subscriptions: {
            where: {
              status: { in: ["ACTIVE", "TRIAL"] },
              OR: [{ endsAt: null }, { endsAt: { gt: now } }]
            },
            orderBy: { startsAt: "desc" },
            take: 1,
            select: { plan: { select: { features: true } } }
          }
        }
      }
    },
    orderBy: { business: { name: "asc" } }
  });

  return memberships.map(({ business, role }) => ({
    id: business.id,
    name: business.name,
    slug: business.slug,
    type: business.type,
    role: role.name,
    enabledModules: business.features
      .map(({ key }) => key)
      .filter((key) => featureFlags(business.subscriptions[0]?.plan.features)[key] !== false)
  }));
}

export async function findUserBusinessContext(
  userId: string,
  businessId: string
): Promise<BusinessContextRecord | null> {
  const now = new Date();
  const membership = await prisma.businessMembership.findUnique({
    where: {
      businessId_userId: {
        businessId,
        userId
      },
      status: "ACTIVE",
      user: { status: "ACTIVE" },
      business: {
        status: "ACTIVE",
        subscriptions: {
          some: {
            status: { in: ["ACTIVE", "TRIAL"] },
            OR: [{ endsAt: null }, { endsAt: { gt: now } }]
          }
        }
      }
    },
    select: {
      role: {
        select: {
          name: true,
          permissions: { select: { permission: { select: { key: true } } } }
        }
      },
      business: {
        select: {
          id: true,
          name: true,
          slug: true,
          type: true,
          features: { where: { enabled: true }, select: { key: true } },
          subscriptions: {
            where: {
              status: { in: ["ACTIVE", "TRIAL"] },
              OR: [{ endsAt: null }, { endsAt: { gt: now } }]
            },
            orderBy: { startsAt: "desc" },
            take: 1,
            select: { plan: { select: { features: true } } }
          }
        }
      }
    }
  });

  if (!membership) {
    return null;
  }

  return {
    business: {
      ...membership.business,
      features: membership.business.features.filter(({ key }) =>
        featureFlags(membership.business.subscriptions[0]?.plan.features)[key] !== false
      )
    },
    role: membership.role.name,
    permissions: membership.role.permissions.map(({ permission }) => permission.key)
  };
}

function defaultModuleConfig(modules: string[]) {
  return modules.map((key) => ({ key, enabled: true }));
}

export async function createBusinessForOwner(ownerUserId: string, input: CreateBusinessInput) {
  const modules = input.enabledModules ?? defaultModules;

  return prisma.$transaction(async (transaction) => {
    const business = await transaction.business.create({
      data: {
        name: input.name,
        slug: input.slug,
        type: input.type,
        country: input.country,
        city: input.city,
        address: input.address,
        phone: input.phone,
        email: input.email,
        currency: input.currency,
        vatRate: input.vatRate,
        settings: { createdThrough: "onboarding" }
      }
    });

    const role = await transaction.businessRole.create({
      data: {
        businessId: business.id,
        name: "SUPER_ADMIN",
        description: "Business owner with full access"
      }
    });
    await transaction.businessFeature.createMany({
      data: defaultModuleConfig(modules).map(({ key, enabled }) => ({
        businessId: business.id,
        key,
        enabled
      }))
    });
    await transaction.businessLocation.create({
      data: {
        businessId: business.id,
        name: `${input.name} — ${input.city}`,
        slug: "main",
        country: input.country,
        city: input.city,
        address: input.address,
        phone: input.phone
      }
    });

    const permissions = await Promise.all(businessPermissionKeys.map((key) =>
      transaction.permission.upsert({
        where: { key },
        create: { key },
        update: {}
      })
    ));

    await transaction.businessRolePermission.createMany({
      data: permissions.map(({ id }) => ({
        businessId: business.id,
        roleId: role.id,
        permissionId: id
      }))
    });

    const plan = await transaction.subscriptionPlan.upsert({
      where: { code: "FREE" },
      create: {
        code: "FREE",
        name: "Free",
        limits: {
          users: 3,
          locations: 1,
          warehouses: 1,
          posDevices: 1,
          products: 500
        },
        features: { ecommerce: false, api: false, advancedReports: false }
      },
      update: {}
    });

    await transaction.businessSubscription.create({
      data: {
        businessId: business.id,
        planId: plan.id,
        status: "ACTIVE"
      }
    });

    await transaction.businessMembership.create({
      data: {
        businessId: business.id,
        userId: ownerUserId,
        roleId: role.id
      }
    });
    await transaction.auditLog.create({
      data: {
        businessId: business.id,
        userId: ownerUserId,
        action: "BUSINESS_CREATED",
        entityType: "Business",
        entityId: business.id
      }
    });

    return {
      id: business.id,
      name: business.name,
      slug: business.slug,
      type: business.type,
      enabledModules: modules,
      role: role.name
    } satisfies BusinessSummary;
  });
}

export async function ensureInitialEdiBusiness(
  transaction: Prisma.TransactionClient,
  ownerUserId: string
) {
  const existingBusiness = await transaction.business.findUnique({
    where: { slug: "edi-electro" },
    select: { id: true }
  });
  const business = await transaction.business.upsert({
    where: { slug: "edi-electro" },
    create: {
      id: "EDI-ELECTRO",
      name: "EDI Electro & Instalues",
      slug: "edi-electro",
      type: "ELECTRICAL",
      country: "Kosovo",
      city: "Prizren",
      currency: "EUR",
      settings: { createdThrough: "initial-tenant-bootstrap" }
    },
    update: {}
  });
  const role = await transaction.businessRole.upsert({
    where: { businessId_name: { businessId: business.id, name: "SUPER_ADMIN" } },
    create: {
      businessId: business.id,
      name: "SUPER_ADMIN",
      description: "EDI Electro business administrator"
    },
    update: {}
  });

  await transaction.businessLocation.upsert({
    where: { businessId_slug: { businessId: business.id, slug: "prizren-shop" } },
    create: {
      businessId: business.id,
      name: "Prizren Shop",
      slug: "prizren-shop",
      country: business.country,
      city: business.city
    },
    update: {}
  });

  const ediModules = [
    ...defaultModules,
    "ecommerce",
    "installers"
  ];
  for (const key of ediModules) {
    await transaction.businessFeature.upsert({
      where: { businessId_key: { businessId: business.id, key } },
      create: { businessId: business.id, key, enabled: true },
      update: { enabled: true }
    });
  }

  for (const key of businessPermissionKeys) {
    const permission = await transaction.permission.upsert({
      where: { key },
      create: { key },
      update: {}
    });
    await transaction.businessRolePermission.upsert({
      where: {
        businessId_roleId_permissionId: {
          businessId: business.id,
          roleId: role.id,
          permissionId: permission.id
        }
      },
      create: { businessId: business.id, roleId: role.id, permissionId: permission.id },
      update: {}
    });
  }

  const plan = await transaction.subscriptionPlan.upsert({
    where: { code: "BUSINESS" },
    create: {
      code: "BUSINESS",
      name: "Business",
      limits: { users: 25, locations: 10, warehouses: 25, posDevices: 25, products: 50000 },
      features: { ecommerce: true, api: false, advancedReports: true }
    },
    update: {}
  });
  const subscription = await transaction.businessSubscription.findFirst({
    where: { businessId: business.id, status: { in: ["ACTIVE", "TRIAL"] } },
    select: { id: true }
  });
  if (!subscription) {
    await transaction.businessSubscription.create({
      data: { businessId: business.id, planId: plan.id }
    });
  }

  await transaction.businessMembership.upsert({
    where: {
      businessId_userId: {
        businessId: business.id,
        userId: ownerUserId
      }
    },
    create: { businessId: business.id, userId: ownerUserId, roleId: role.id },
    update: { roleId: role.id, status: "ACTIVE" }
  });
  if (!existingBusiness) {
    await transaction.auditLog.create({
      data: {
        businessId: business.id,
        userId: ownerUserId,
        action: "BUSINESS_CREATED",
        entityType: "Business",
        entityId: business.id,
        metadata: { source: "initial-tenant-bootstrap" }
      }
    });
  }
}

export async function createLocationForBusiness(
  businessId: string,
  input: CreateLocationInput
) {
  return prisma.businessLocation.create({
    data: {
      businessId,
      ...input
    },
    select: {
      id: true,
      businessId: true,
      name: true,
      slug: true,
      country: true,
      city: true,
      address: true,
      phone: true,
      isActive: true
    }
  });
}

export function isUniqueConstraintError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}
