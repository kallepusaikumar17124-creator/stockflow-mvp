import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";

async function getAuthSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;
  if (!token) return null;
  return verifyToken(token);
}

// GET all products for the current organization
export async function GET() {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const products = await prisma.product.findMany({
      where: { organizationId: session.organizationId },
      orderBy: { createdAt: "desc" },
    });

    const org = await prisma.organization.findUnique({
      where: { id: session.organizationId },
      select: { defaultLowStockThreshold: true },
    });

    return NextResponse.json({
      products,
      defaultThreshold: org?.defaultLowStockThreshold ?? 5,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to fetch products" },
      { status: 500 }
    );
  }
}

// POST create a new product scoped to the organization
export async function POST(req: Request) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { name, sku, description, quantityOnHand, costPrice, sellingPrice, lowStockThreshold } =
      await req.json();

    if (!name || !sku) {
      return NextResponse.json(
        { error: "Product name and SKU are required" },
        { status: 400 }
      );
    }

    const existingProduct = await prisma.product.findUnique({
      where: {
        organizationId_sku: {
          organizationId: session.organizationId,
          sku: sku.trim(),
        },
      },
    });

    if (existingProduct) {
      return NextResponse.json(
        { error: `SKU '${sku}' already exists in your organization.` },
        { status: 400 }
      );
    }

    const product = await prisma.product.create({
      data: {
        organizationId: session.organizationId,
        name: name.trim(),
        sku: sku.trim(),
        description: description?.trim() || null,
        quantityOnHand: Number(quantityOnHand) || 0,
        costPrice: costPrice !== undefined && costPrice !== "" ? Number(costPrice) : null,
        sellingPrice: sellingPrice !== undefined && sellingPrice !== "" ? Number(sellingPrice) : null,
        lowStockThreshold:
          lowStockThreshold !== undefined && lowStockThreshold !== ""
            ? Number(lowStockThreshold)
            : null,
      },
    });

    return NextResponse.json({ product }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to create product" },
      { status: 500 }
    );
  }
}