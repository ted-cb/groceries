import dotenv from 'dotenv';
import { createApp } from './app';

dotenv.config();

const app = createApp();
const port = Number(process.env.PORT) || 4000;

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Backend listening on http://localhost:${port}`);
});
