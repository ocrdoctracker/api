import dotenv from 'dotenv';
dotenv.config();

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 3000),
  httpsPort: Number(process.env.HTTPS_PORT || 3443),
  sslKey: process.env.SSL_KEY,
  sslCert: process.env.SSL_CERT,
  db: {
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    name: process.env.DB_NAME,
    pass: process.env.DB_PASSWORD,
    port: Number(process.env.DB_PORT || 5432),
    ssl: process.env.DB_SSL === 'true' || false,
  },
  bcryptRounds: Number(process.env.BCRYPT_SALT_ROUNDS || 10),
  ev: {
    evEmail: process.env.EV_EMAIL,
    evPass: process.env.EV_PASS,
    evAddress: process.env.EV_ADDRESS,
    evResetSubject: process.env.EV_RESET_SUBJECT,
    evCompany: process.env.EV_COMPANY,
    evUrl: process.env.EV_URL,
    evTemplate: process.env.EV_TEMPLATE,
    evResetTemplate: process.env.EV_RESET_TEMPLATE,
    
  }
};
