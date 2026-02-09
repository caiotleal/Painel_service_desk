import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

if (!admin.apps.length) {
    admin.initializeApp();
}
const db = admin.firestore();

export const freshdeskWebhook = functions.https.onRequest(async (req, res) => {
    try {
        const data = req.body;
        // Captura ID e garante que seja String
        const rawId = data.id || (data.ticket && data.ticket.id) || data.ticket_id;

        if (!rawId) {
            res.status(400).send("ID ausente.");
            return;
        }

        const ticketId = String(rawId);
        const ticketRef = db.collection("tickets").doc(ticketId);

        // Lógica de Status para deletar se estiver fechado
        const status = (data.status || "").toString().toLowerCase();
        if (["fechado", "closed", "resolvido", "resolved"].includes(status)) {
            await ticketRef.delete();
            res.status(200).send("Removido.");
            return;
        }

        // Salva TUDO o que vier no JSON de forma dinâmica
        await ticketRef.set(data, { merge: true });
        res.status(200).send("Sincronizado.");
    } catch (error) {
        console.error("Erro:", error);
        res.status(500).send("Erro interno.");
    }
});