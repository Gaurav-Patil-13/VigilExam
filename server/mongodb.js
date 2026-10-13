import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from project root .env
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const MONGODB_URI = process.env.MONGODB_URI || '';
const DB_NAME = process.env.DB_NAME || 'vigilexam';

let connectionStatus = {
  isConnected: false,
  status: 'DISCONNECTED', // 'CONNECTED' | 'DISCONNECTED' | 'AWAITING_CREDENTIALS' | 'ERROR'
  host: null,
  database: DB_NAME,
  error: null,
  checkedAt: null
};

// Redacts password from connection URI for safe logging
export function getSafeUri(uri = MONGODB_URI) {
  if (!uri) return 'NOT_CONFIGURED';
  try {
    return uri.replace(/:([^:@]+)@/, ':****@');
  } catch (e) {
    return 'REDACTED_URI';
  }
}

export function isMongoConnected() {
  return mongoose.connection.readyState === 1 && connectionStatus.isConnected;
}

export function getMongoStatus() {
  const readyStates = ['disconnected', 'connected', 'connecting', 'disconnecting'];
  const stateStr = readyStates[mongoose.connection.readyState] || 'unknown';
  return {
    ...connectionStatus,
    readyState: stateStr,
    uriPreview: getSafeUri(MONGODB_URI)
  };
}

export async function connectMongoDB() {
  connectionStatus.checkedAt = new Date().toISOString();

  // Validate presence of MONGODB_URI
  if (!MONGODB_URI || MONGODB_URI.trim() === '') {
    connectionStatus = {
      isConnected: false,
      status: 'AWAITING_CREDENTIALS',
      host: null,
      database: DB_NAME,
      error: 'MONGODB_URI is not set in environment or .env file.',
      checkedAt: new Date().toISOString()
    };
    console.warn(`[MongoDB] ${connectionStatus.error}`);
    return { success: false, ...connectionStatus };
  }

  // Detect un-replaced password placeholders
  if (MONGODB_URI.includes('<NEW_PASSWORD>') || MONGODB_URI.includes('<PASSWORD>')) {
    connectionStatus = {
      isConnected: false,
      status: 'AWAITING_CREDENTIALS',
      host: 'cluster0.tcfl6zh.mongodb.net',
      database: DB_NAME,
      error: 'MONGODB_URI contains credential placeholder (<NEW_PASSWORD>). Please supply the database user password in .env.',
      checkedAt: new Date().toISOString()
    };
    console.warn(`[MongoDB] Atlas Integration ready: ${connectionStatus.error}`);
    return { success: false, ...connectionStatus };
  }

  try {
    // Strip accidental angle brackets around password if present (e.g. :<password>@)
    const effectiveUri = MONGODB_URI.replace(/:<([^>]+)>@/, ':$1@');
    console.info(`[MongoDB] Connecting to Atlas at ${getSafeUri(effectiveUri)} ...`);
    
    // Set strict connection options
    await mongoose.connect(effectiveUri, {
      dbName: DB_NAME,
      serverSelectionTimeoutMS: 8000,
      connectTimeoutMS: 10000
    });

    const host = mongoose.connection.host || 'cluster0.tcfl6zh.mongodb.net';
    connectionStatus = {
      isConnected: true,
      status: 'CONNECTED',
      host,
      database: DB_NAME,
      error: null,
      checkedAt: new Date().toISOString()
    };

    console.info(`[MongoDB] Successfully connected to MongoDB Atlas (${host}/${DB_NAME})`);
    return { success: true, ...connectionStatus };
  } catch (err) {
    connectionStatus = {
      isConnected: false,
      status: 'ERROR',
      host: null,
      database: DB_NAME,
      error: err.message,
      checkedAt: new Date().toISOString()
    };
    console.error(`[MongoDB] Atlas connection failure: ${err.message}`);
    return { success: false, ...connectionStatus };
  }
}

// Mongoose connection lifecycle listeners
mongoose.connection.on('connected', () => {
  connectionStatus.isConnected = true;
  connectionStatus.status = 'CONNECTED';
});

mongoose.connection.on('error', (err) => {
  connectionStatus.isConnected = false;
  connectionStatus.status = 'ERROR';
  connectionStatus.error = err.message;
  console.error(`[MongoDB] Runtime connection error: ${err.message}`);
});

mongoose.connection.on('disconnected', () => {
  connectionStatus.isConnected = false;
  connectionStatus.status = 'DISCONNECTED';
  console.warn('[MongoDB] Disconnected from database.');
});
