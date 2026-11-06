import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { signToken } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const { email, password, organizationName } = await req.json();

    if (!email || !password || !organizationName) {
      return NextResponse.json(
        { error: "Email, password, and organization name are required" },
        { status: 400 }
      );
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "A user with this email already exists" },
        { status: 409 }
      );
    }

    // Hash password with salt rounds = 10
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create Organization and primary User record together
    const organization = await prisma.organization.create({
      data: {
        name: organizationName,
        users: {
          create: {
            email,
            password: hashedPassword,
          },
        },
      },
      include: {
        users: true,
      },
    });

    const user = organization.users[0];

    // Issue JWT token with tenant isolation data
    const token = signToken({
      userId: user.id,
      email: user.email,
      organizationId: organization.id,
    });

    const response = NextResponse.json({
      message: "Registration successful",
      user: {
        id: user.id,
        email: user.email,
        organizationId: organization.id,
        organizationName: organization.name,
      },
    });

    response.cookies.set("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });

    return response;
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to create account" },
      { status: 500 }
    );
  }
}