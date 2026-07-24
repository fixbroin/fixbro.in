const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

const host = process.env.MYSQL_HOST || 'localhost';
const user = process.env.MYSQL_USER || 'root';
const password = process.env.MYSQL_PASSWORD || '';
const databaseName = process.env.MYSQL_DATABASE || 'fixbro_db';
const port = parseInt(process.env.MYSQL_PORT || '3306', 10);

async function main() {
  let dbConn;
  try {
    dbConn = await mysql.createConnection({
      host,
      user,
      password,
      database: databaseName,
      port,
      connectTimeout: 10000
    });

    const [rows] = await dbConn.query("SELECT data FROM webSettings WHERE id = 'storageConfiguration'");
    console.log('--- STORAGE CONFIGURATION ---');
    if (rows.length > 0) {
      console.log(JSON.stringify(JSON.parse(rows[0].data), null, 2));
    } else {
      console.log('No custom storage configuration found in DB.');
    }

  } catch (err) {
    console.error('Error connecting to db:', err);
  } finally {
    if (dbConn) await dbConn.end();
  }
}

main();
