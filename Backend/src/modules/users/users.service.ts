import { prisma } from "../../prisma";
import bcpt from "bcryptjs";
import type { Prisma } from "../../../generated/prisma/client";

export class AuthServiceError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public code: string,
  ) {
    super(message);

    this.name = "AuthServiceError";
  }
}

interface UpdateUserInput {
  userId: string;
  name?: string;
  avatarUrl?: string | null;
}

interface UpdatePasswordInput {
  userId: string;
  Opassword: string;
  Npassword: string;
}

export const UpdateUser = async ({
  userId,
  name,
  avatarUrl,
}: UpdateUserInput) => {
  const user = await prisma.user.update({
    where: {
      id: userId,
    },
    data: {
      ...(name !== undefined && { name }),
      ...(avatarUrl !== undefined && { avatarUrl }),
    },
    select: {
      id: true,
      name: true,
      email: true,
      avatarUrl: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  return user;
};

export const UpdatePassword = async ({
  userId,
  Opassword,
  Npassword,
}: UpdatePasswordInput) => {
  // 1. Find the user in the database
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new AuthServiceError("User not found", 404, "USER_NOT_FOUND");
  }

  // 2. Verify the current password
  const isPasswordCorrect = await bcpt.compare(Opassword, user.passwordHash);

  if (!isPasswordCorrect) {
    throw new AuthServiceError(
      "Incorrect current password",
      400,
      "INVALID_CURRENT_PASSWORD",
    );
  }

  // 3. Prevent using the same password again
  const isSamePassword = await bcpt.compare(Npassword, user.passwordHash);

  if (isSamePassword) {
    throw new AuthServiceError(
      "New password must be different",
      400,
      "SAME_PASSWORD",
    );
  }

  // 4. Hash the new password before storing it
  const passwordHash = await bcpt.hash(Npassword, 12);

  // 5. Update the password in the database
  const updatedUser = await prisma.user.update({
    where: { id: userId },

    data: {
      passwordHash,
    },
  });

  return updatedUser;
};

export const SearchUser = async (query: string) => {

  // Check whether query is a valid UUID
  const isUUID =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(query);

  // Prepare search conditions
  const searchConditions: Prisma.UserWhereInput[] = [
    {
      name: {
        contains: query,
        mode: "insensitive",
      },
    },
    {
      email: {
        contains: query,
        mode: "insensitive",
      },
    },
  ];

  // Add ID condition only for valid UUIDs
  if (isUUID) {
    searchConditions.push({
      id: query,
    });
  }

  // Execute search
  return await prisma.user.findMany({
    where: {
      OR: searchConditions,
    },

    select: {
      id: true,
      name: true,
      email: true,
      avatarUrl: true,
    },

    take: 10,
  });
};
