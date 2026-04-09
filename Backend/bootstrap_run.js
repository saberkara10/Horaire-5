/**
 * Script de bootstrap des données académiques.
 * Usage : node bootstrap_run.js
 */
import { SchedulerDataBootstrap } from './src/services/scheduler/SchedulerDataBootstrap.js';

console.log('=== BOOTSTRAP DEMARRAGE ===\n');

try {
  const report = await SchedulerDataBootstrap.ensureOperationalDataset();

  console.log('=== BOOTSTRAP TERMINE ===\n');

  console.log('CREE:');
  Object.entries(report.created).forEach(([k, v]) => {
    if (v > 0) console.log(`  + ${k}: ${v}`);
  });

  console.log('\nMIS A JOUR:');
  Object.entries(report.updated).forEach(([k, v]) => {
    if (v > 0) console.log(`  ~ ${k}: ${v}`);
  });

  console.log('\nNETTOYE:');
  Object.entries(report.cleaned).forEach(([k, v]) => {
    if (v > 0) console.log(`  - ${k}: ${v}`);
  });

  console.log('\nDETAILS:');
  report.details.forEach(d => console.log(' ', d));

  process.exit(0);
} catch (error) {
  console.error('ERREUR BOOTSTRAP:', error.message);
  console.error(error.stack?.split('\n').slice(0, 8).join('\n'));
  process.exit(1);
}
