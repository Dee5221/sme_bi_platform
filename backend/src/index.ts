import 'dotenv/config';
import { createApp } from './app';
import { ensureSystemRoles } from './services/authService';
import { seedIfEmpty } from './services/seedService';

const port = Number(process.env.PORT || 4000);
const app = createApp();

ensureSystemRoles()
  .then(() => seedIfEmpty())
  .then(() => {
    app.listen(port, () => {
      console.log(`SME API listening on http://localhost:${port}`);
    });
  })
  .catch((error) => {
    console.error('Failed to initialize application:', error);
    process.exit(1);
  });
