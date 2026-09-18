import "server-only";

import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getMessaging, type Messaging } from "firebase-admin/messaging";

function getRequiredEnv(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing required server environment variable: ${name}`);
  }

  return value;
}

export function getFirebaseMessaging(): Messaging {
  if (getApps().length === 0) {
    const projectId = getRequiredEnv("FIREBASE_PROJECT_ID");
    const clientEmail = getRequiredEnv("FIREBASE_CLIENT_EMAIL");

    const privateKey = getRequiredEnv("FIREBASE_PRIVATE_KEY").replace(
      /\\n/g,
      "\n"
    );

    initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey,
      }),
    });
  }

  return getMessaging();
}

export default getFirebaseMessaging;