const app = require("./app");

/**
 * Port d’écoute du serveur.
 */
const PORT = process.env.PORT || 3000;

/**
 * Lancement du serveur HTTP.
 */
app.listen(PORT, () => {
  console.log(`Serveur démarré sur http://localhost:${PORT}`);
});
