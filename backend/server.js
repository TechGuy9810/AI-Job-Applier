
import dotenv from 'dotenv';
import app from './app.js';
import connectDB from './config/db.js';
import config from './config/config.js';
// Load env variables
dotenv.config();

const startServer = async () => {
  try {
    await connectDB();

    app.listen(PORT, () => {
      console.log(`Server running on port ${config.port}`);
    });

  } catch (error) {
    console.error(error);
    process.exit(1);
  }
};

startServer();