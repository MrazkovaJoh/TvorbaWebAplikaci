require('dotenv').config();
const oracledb = require('oracledb');

// Konfigurace pripojeni k Oracle
const dbConfig = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    connectString: process.env.DB_CONNECT_STRING
};
async function executeQuery(sql, binds = {}) {
    let connection;
    try {
        // Otevreni spojeni
        connection = await oracledb.getConnection(dbConfig);
        
        const result = await connection.execute(sql, binds, { 
            autoCommit: true, 
            outFormat: oracledb.OUT_FORMAT_OBJECT 
        });

        return result;
    } catch (err) {
        // Detailni logovani chyby do konzole serveru
        console.error("Databázová chyba:");
        console.error("SQL:", sql);
        console.error("Binds:", binds);
        console.error("Error message:", err.message);
        throw err;
    } finally {
        if (connection) {
            try {
                await connection.close();
            } catch (err) {
                console.error("Chyba při uzavírání spojení:", err);
            }
        }
    }
}
module.exports = { executeQuery };
