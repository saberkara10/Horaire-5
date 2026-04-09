import pool from './db.js';
const [p] = await pool.query('SELECT COUNT(*) as n FROM professeurs');
const [c] = await pool.query('SELECT COUNT(*) as n FROM cours WHERE archive=0');
const [e] = await pool.query('SELECT COUNT(*) as n FROM etudiants');
const [g] = await pool.query('SELECT COUNT(*) as n FROM groupes_etudiants');
const [s] = await pool.query('SELECT COUNT(*) as n FROM salles');
const [d] = await pool.query('SELECT COUNT(*) as n FROM disponibilites_professeurs');
const [dist] = await pool.query('SELECT MIN(nb) as min_c, MAX(nb) as max_c, ROUND(AVG(nb),1) as avg_c FROM (SELECT COUNT(id_cours) as nb FROM professeur_cours GROUP BY id_professeur) t');
const [types] = await pool.query("SELECT type, COUNT(*) as nb FROM salles GROUP BY type ORDER BY nb DESC");
console.log('=== ETAT POST-BOOTSTRAP ===');
console.log('Profs:', p[0].n, '| Cours:', c[0].n, '| Etudiants:', e[0].n, '| Groupes:', g[0].n, '| Salles:', s[0].n);
console.log('Dispos:', d[0].n);
console.log('Charge par prof: min', dist[0].min_c, '/ moy', dist[0].avg_c, '/ max', dist[0].max_c);
console.log('Salles par type:');
types.forEach(r => console.log('  ', r.type, ':', r.nb));
// Check capacity
const totalSlots = s[0].n * 5 * 4; // 5 jours × 4 créneaux
const demand = 8 * 4 * 4 * 7; // 8 programmes × 4 étapes × 4 groupes × 7 cours
console.log(`\nCapacite: ${totalSlots} slots/semaine vs ${demand} demande → ${(totalSlots/demand*100).toFixed(0)}%`);
await pool.end();
