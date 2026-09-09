import mongoose from 'mongoose';
import app from './app.js';
import { env } from './config/env.js';

async function start() {
  await mongoose.connect(env.MONGODB_URI);
  app.listen(env.PORT, () => console.log(`API listening on port ${env.PORT}`));
}

start().catch((error) => {
  console.error('Failed to start API', error);
  process.exit(1);
});
