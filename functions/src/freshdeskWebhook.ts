import { onRequest } from "firebase-functions/v2/https";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import cors from "cors";
import express from "express";

// Inicializa o Admin
initializeApp();
const db = getFirestore();

const app = express();
app.use(cors({ origin: true }));

app.post("/", async (req, res): Promise<any> => { // Adicionado Promise<any> para o TS ficar satisfeito
  try {
    const ticket = req.body;

    if (!ticket || !ticket.id) {
      // O 'return' aqui garante que a função pare se o ticket for inválido
      return res.status(400).send({ error: "Ticket inválido" });
    }

    const ticketRef = db.collection("tickets").doc(ticket.id.toString());

    if (
      ticket.status && 
      (ticket.status.toLowerCase() === "fechado" || ticket.status.toLowerCase() === "closed")
    ) {
      await ticketRef.delete();
      console.log(`Ticket ${ticket.id} removido.`);
    } else {
      await ticketRef.set(ticket, { merge: true });
      console.log(`Ticket ${ticket.id} salvo/atualizado.`);
    }

    // Finaliza o caminho de sucesso
    return res.status(200).send({ message: "Webhook processado com sucesso" });

  } catch (error) {
    console.error("Erro ao processar webhook:", error);
    // Finaliza o caminho de erro
    return res.status(500).send({ error: "Erro interno" });
  }
});

export const freshdeskWebhook = onRequest(app);