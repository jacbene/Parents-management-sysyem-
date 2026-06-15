import { purgeDatabase } from './seeder';

async function runPurge() {
    console.log('Starting the database purge process...');
    await purgeDatabase();
    console.log('Database purge process completed.');
}

runPurge();
