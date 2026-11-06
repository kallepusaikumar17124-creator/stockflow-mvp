import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { prisma } from "@/lib/prisma";

const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "stockflow-super-secure-production-jwt-key"
);

async function getAuthOrgId() {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, SECRET);
    return (payload as { organizationId: string }).organizationId;
  } catch {
    return null;
  }
}

// GET /api/products
export async function GET() {
  const orgId = await getAuthOrgId();
  if (!orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const products = await prisma.product.findMany({
    where: { organizationId: orgId },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ products });
}

// POST /api/products (Handles single creation or auto-seed demo products)
export async function POST(req: Request) {
  const orgId = await getAuthOrgId();
  if (!orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();

  // Handle automatic sample product generation
  if (body.action === "auto-generate") {
    const demoItems = [
      {
        name: "Wireless Ergonomic Mouse",
        sku: `DEMO-MSE-${Date.now().toString().slice(-4)}`,
        category: "Electronics",
        currentStock: 35,
        costPrice: 450,
        sellingPrice: 899,
        lowStockThreshold: 10,
        organizationId: orgId,
      },
      {
        name: "Mechanical Keyboard RGB",
        sku: `DEMO-KBD-${Date.now().toString().slice(-4)}`,
        category: "Electronics",
        currentStock: 8,
        costPrice: 1600,
        sellingPrice: 2499,
        lowStockThreshold: 10,
        organizationId: orgId,
      },
      {
        name: "USB-C Fast Charging Cable (2m)",
        sku: `DEMO-CBL-${Date.now().toString().slice(-4)}`,
        category: "Accessories",
        currentStock: 50,
        costPrice: 90,
        sellingPrice: 249,
        lowStockThreshold: 15,
        organizationId: orgId,
      },
      {
        name: "Laptop Stand Aluminum",
        sku: `DEMO-STD-${Date.now().toString().slice(-4)}`,
        category: "Office",
        currentStock: 4,
        costPrice: 550,
        sellingPrice: 1199,
        lowStockThreshold: 5,
        organizationId: orgId,
      },
    ];

    await prisma.product.createMany({
      data: demoItems,
    });

    return NextResponse.json({ message: "Demo products generated successfully" });
  }

  // Single product creation
  const { name, sku, category, currentStock, costPrice, sellingPrice, lowStockThreshold } = body;

  if (!name || !sku) {
    return NextResponse.json({ error: "Product name and SKU are required" }, { status: 400 });
  }

  try {
    const product = await prisma.product.create({
      data: {
        name,
        sku,
        category: category || "General",
        currentStock: Number(currentStock) || 0,
        costPrice: Number(costPrice) || 0,
        sellingPrice: Number(sellingPrice) || 0,
        lowStockThreshold: Number(lowStockThreshold) || 10,
        organizationId: orgId,
      },
    });
    return NextResponse.json({ product }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.code === "P2002" ? "SKU already exists in organization" : "Failed to create product" },
      { status: 400 }
    );
  }
}