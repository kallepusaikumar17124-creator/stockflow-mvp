import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    const products = await prisma.product.findMany({
      where: { organizationId: payload.organizationId },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ products, defaultThreshold: 5 });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to fetch products" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    const body = await req.json();
    const { name, sku, description, quantityOnHand, costPrice, sellingPrice, lowStockThreshold } = body;

    if (!name || !sku) {
      return NextResponse.json(
        { error: "Product name and SKU are required" },
        { status: 400 }
      );
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
    return NextResponse.json(
      { error: error.message || "Failed to create product" },
      { status: 500 }
    );
  }
}
