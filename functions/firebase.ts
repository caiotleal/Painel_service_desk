import * as admin from "firebase-admin";

// Inicializa o admin apenas uma vez
if (!admin.apps.length) {
    admin.initializeApp();
}

export const db = admin.firestore();