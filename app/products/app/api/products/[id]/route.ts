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

// PUT /api/products/[id] (Edit product via modal)
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const orgId = await getAuthOrgId();
  if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();

  const { name, sku, category, currentStock, costPrice, sellingPrice, lowStockThreshold } = body;

  try {
    const updated = await prisma.product.updateMany({
      where: { id, organizationId: orgId },
      data: {
        name,
        sku,
        category,
        currentStock: Number(currentStock),
        costPrice: Number(costPrice),
        sellingPrice: Number(sellingPrice),
        lowStockThreshold: Number(lowStockThreshold),
      },
    });

    if (updated.count === 0) {
      return NextResponse.json({ error: "Product not found or unauthorized" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: "Failed to update product" }, { status: 500 });
  }
}

// DELETE /api/products/[id] (Delete product)
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const orgId = await getAuthOrgId();
  if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  try {
    const deleted = await prisma.product.deleteMany({
      where: { id, organizationId: orgId },
    });

    if (deleted.count === 0) {
      return NextResponse.json({ error: "Product not found or unauthorized" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Failed to delete product" }, { status: 500 });
  }
}