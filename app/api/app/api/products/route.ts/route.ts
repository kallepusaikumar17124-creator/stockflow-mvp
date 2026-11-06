import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";

async function getAuthPayload() {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;
  if (!token) return null;
  return verifyToken(token);
}

export async function GET() {
  try {
    const payload = await getAuthPayload();
    if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const [products, org] = await Promise.all([
      prisma.product.findMany({
        where: { organizationId: payload.organizationId },
        orderBy: { createdAt: "desc" },
      }),
      prisma.organization.findUnique({
        where: { id: payload.organizationId },
        select: { defaultStockThreshold: true },
      }),
    ]);

    return NextResponse.json({
      products,
      defaultThreshold: org?.defaultStockThreshold ?? 5,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to fetch products" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const payload = await getAuthPayload();
    if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { name, sku, description, quantityOnHand, costPrice, sellingPrice, lowStockThreshold } = body;

    if (!name || !sku) {
      return NextResponse.json({ error: "Product name and SKU are required" }, { status: 400 });
    }

    const product = await prisma.product.create({
      data: {
        organizationId: payload.organizationId,
        name,
        sku,
        description: description || null,
        quantityOnHand: Number(quantityOnHand) || 0,
        costPrice: costPrice !== "" && costPrice !== null ? parseFloat(costPrice) : null,
        sellingPrice: sellingPrice !== "" && sellingPrice !== null ? parseFloat(sellingPrice) : null,
        lowStockThreshold: lowStockThreshold !== "" && lowStockThreshold !== null ? parseInt(lowStockThreshold, 10) : null,
      },
    });

    return NextResponse.json({ product }, { status: 201 });
  } catch (error: any) {
    if (error.code === "P2002") {
      return NextResponse.json(
        { error: "A product with this SKU already exists in your organization" },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: error.message || "Failed to create product" }, { status: 500 });
  }
}

// FULL EDIT HANDLER (FR-4 & FR-5)
export async function PUT(req: Request) {
  try {
    const payload = await getAuthPayload();
    if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { id, name, sku, description, quantityOnHand, costPrice, sellingPrice, lowStockThreshold } = body;

    if (!id) {
      return NextResponse.json({ error: "Product ID is required" }, { status: 400 });
    }

    // Tenant check: ensure product belongs to this organization
    const existing = await prisma.product.findFirst({
      where: { id, organizationId: payload.organizationId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    const updatedProduct = await prisma.product.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(sku !== undefined && { sku }),
        ...(description !== undefined && { description }),
        ...(quantityOnHand !== undefined && { quantityOnHand: Math.max(0, Number(quantityOnHand)) }),
        ...(costPrice !== undefined && { costPrice: costPrice !== "" && costPrice !== null ? parseFloat(costPrice) : null }),
        ...(sellingPrice !== undefined && { sellingPrice: sellingPrice !== "" && sellingPrice !== null ? parseFloat(sellingPrice) : null }),
        ...(lowStockThreshold !== undefined && { lowStockThreshold: lowStockThreshold !== "" && lowStockThreshold !== null ? parseInt(lowStockThreshold, 10) : null }),
      },
    });

    return NextResponse.json({ product: updatedProduct });
  } catch (error: any) {
    if (error.code === "P2002") {
      return NextResponse.json({ error: "SKU conflict with another product" }, { status: 409 });
    }
    return NextResponse.json({ error: error.message || "Failed to update product" }, { status: 500 });
  }
}

// FULL DELETE HANDLER (FR-4)
export async function DELETE(req: Request) {
  try {
    const payload = await getAuthPayload();
    if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) return NextResponse.json({ error: "Product ID is required" }, { status: 400 });

    const existing = await prisma.product.findFirst({
      where: { id, organizationId: payload.organizationId },
    });
    if (!existing) return NextResponse.json({ error: "Product not found" }, { status: 404 });

    await prisma.product.delete({ where: { id } });

    return NextResponse.json({ message: "Product deleted successfully" });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to delete product" }, { status: 500 });
  }
}