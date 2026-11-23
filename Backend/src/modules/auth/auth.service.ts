
import { compare, hash } from "bcryptjs";
import jwt from "jsonwebtoken";

import { prisma } from "../../prisma";


// ==========================================
// AUTHENTICATION ERROR
// ==========================================

// A small custom error class.
//
// statusCode tells our centralized error middleware
// what HTTP status code should be returned.
//
// code provides a consistent machine-readable error code.

export class AuthServiceError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public code: string
  ) {
    super(message);

    this.name = "AuthServiceError";
  }
}


// ==========================================
// INPUT TYPES
// ==========================================

// Describes the information needed to register a user.

interface RegisterUserInput {
  name: string;
  email: string;
  password: string;
}

// Describes the information needed to log in.

interface LoginUserInput {
  nameOrEmail: string;
  password: string;
}


// ==========================================
// HELPER FUNCTIONS
// ==========================================

// Get the JWT secret from environment variables.
//
// We don't hardcode secret keys inside our application.
// The secret must be configured in the .env file.

const getJwtSecret = (): string => {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error("JWT_SECRET is not configured");
  }

  return secret;
};


// Check whether a Prisma error is a unique constraint error.
// PostgreSQL/Prisma uses P2002 for unique constraint violations.
// This also handles two simultaneous registration requests
// trying to use the same email address.

const isUniqueConstraintError = (error: unknown): boolean => {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2002"
  );
};


// ==========================================
// 1. REGISTER USER
// ==========================================

export const registerUser = async ({
  name,
  email,
  password,
}: RegisterUserInput) => {

  // Normalize the input so that emails such as
  // Vansh@Example.com and vansh@example.com
  // are treated as the same email address.

  const normalizedName = name.trim();
  const normalizedEmail = email.trim().toLowerCase();


  // STEP 1: Check whether the email already exists.

  const existingUser = await prisma.user.findUnique({
    where: {
      email: normalizedEmail,
    },
  });

  // If the email already exists, stop registration.

  if (existingUser) {
    throw new AuthServiceError(
      "An account with this email already exists",
      409,
      "EMAIL_ALREADY_EXISTS"
    );
  }


  // STEP 2: Hash the user's password.

  // Never store the original password in PostgreSQL.
  // 12 is the bcrypt work factor.

  const passwordHash = await hash(password, 12);


  // STEP 3: Create the user in PostgreSQL.

  try {
    const user = await prisma.user.create({

      data: {
        name: normalizedName,
        email: normalizedEmail,
        passwordHash,
      },

      // Only return safe user information.
      // Never return passwordHash in the response.

      select: {
        id: true,
        name: true,
        email: true,
        avatarUrl: true,
        createdAt: true,
      },
    });

    return user;

  } catch (error) {

    // Handle a duplicate email caused by simultaneous
    // registration requests.

    if (isUniqueConstraintError(error)) {
      throw new AuthServiceError(
        "An account with this email already exists",
        409,
        "EMAIL_ALREADY_EXISTS"
      );
    }

    // Pass unexpected errors to the global error handler.

    throw error;
  }
};

// ==========================================
// 2. Check UseName Uniqueness
// ==========================================


export const checkUsernameAvailability = async (name: string) => {

  // Normalize the username.
  const normalizedName = name.trim();

  // Check whether this username already exists.
  const existingUser = await prisma.user.findUnique({
    where: {
      name: normalizedName,
    },
    select: {
      id: true,
    },
  });

  // Return availability status.
  return {
    available: !existingUser,
  };
};


// ==========================================
// 2. LOGIN USER
// ==========================================

export const loginUser = async ({
  nameOrEmail,
  password,
}: LoginUserInput) => {

  // STEP 1: Normalize the email.

  const normalizedNameOrEmail = nameOrEmail.trim();


  // STEP 2: Find the user in PostgreSQL.

  // We explicitly select passwordHash because Prisma
  // needs it to compare the submitted password.

  const user = await prisma.user.findFirst({
    where: {
      OR:[
        { email: normalizedNameOrEmail.toLowerCase() },
        { name: normalizedNameOrEmail },
      ],
    },

    select: {
      id: true,
      name: true,
      email: true,
      passwordHash: true,
      avatarUrl: true,
      createdAt: true,
    },
  });


  // STEP 3: Verify whether the user exists.

  // Use the same error for an unknown email and an
  // incorrect password to avoid revealing which emails
  // are registered.

  if (!user) {
    throw new AuthServiceError(
      "Invalid email or password",
      401,
      "INVALID_CREDENTIALS"
    );
  }


  // STEP 4: Compare the submitted password with
  // the stored bcrypt password hash.

  const isPasswordValid = await compare(
    password,
    user.passwordHash
  );

  if (!isPasswordValid) {
    throw new AuthServiceError(
      "Invalid email or password",
      401,
      "INVALID_CREDENTIALS"
    );
  }


  // STEP 5: Generate a JWT.

  // The sub (subject) claim identifies the authenticated user.
  // Our authentication middleware will use this ID later.

  const token = jwt.sign(
    {
      sub: user.id,
    },
    getJwtSecret(),
    {
      expiresIn: "7d",
    }
  );


  // STEP 6: Remove passwordHash before returning user data.

  // The controller will receive the token and user separately.
  // It should put the token in an HTTP-only cookie.

  const { passwordHash, ...safeUser } = user;

  return {
    user: safeUser,
    token,
  };
};


// ==========================================
// 3. GET CURRENT AUTHENTICATED USER
// ==========================================

export const getCurrentUser = async (userId: string) => {

  // STEP 1: Find the authenticated user using their ID.

  // userId should come from the verified JWT,
  // not from a user ID supplied in the request body.

  const user = await prisma.user.findUnique({
    where: {
      id: userId,
    },

    // Return only public profile information.

    select: {
      id: true,
      name: true,
      email: true,
      avatarUrl: true,
      createdAt: true,
      updatedAt: true,
    },
  });


  // STEP 2: Handle a user account that no longer exists.

  if (!user) {
    throw new AuthServiceError(
      "User account no longer exists",
      401,
      "USER_NOT_FOUND"
    );
  }


  // STEP 3: Return the safe user profile.

  return user;
};
