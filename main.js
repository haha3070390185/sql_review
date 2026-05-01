const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const mysql = require('mysql2/promise');

let mainWindow;
let dbConnection = null;

// MySQL保留关键字列表（常用）
const MYSQL_RESERVED_WORDS = new Set([
    'ADD', 'ALL', 'ALTER', 'ANALYZE', 'AND', 'AS', 'ASC', 'ASENSITIVE',
    'BEFORE', 'BETWEEN', 'BIGINT', 'BINARY', 'BLOB', 'BOTH', 'BY',
    'CALL', 'CASCADE', 'CASE', 'CHANGE', 'CHAR', 'CHARACTER', 'CHECK',
    'COLLATE', 'COLUMN', 'CONDITION', 'CONSTRAINT', 'CONTINUE', 'CONVERT',
    'CREATE', 'CROSS', 'CURRENT_DATE', 'CURRENT_TIME', 'CURRENT_TIMESTAMP',
    'CURRENT_USER', 'CURSOR',
    'DATABASE', 'DATABASES', 'DAY_HOUR', 'DAY_MICROSECOND', 'DAY_MINUTE',
    'DAY_SECOND', 'DEC', 'DECIMAL', 'DECLARE', 'DEFAULT', 'DELAYED', 'DELETE',
    'DESC', 'DESCRIBE', 'DETERMINISTIC', 'DISTINCT', 'DISTINCTROW', 'DIV',
    'DOUBLE', 'DROP', 'DUAL',
    'EACH', 'ELSE', 'ELSEIF', 'ENCLOSED', 'ESCAPED', 'EXISTS', 'EXIT',
    'EXPLAIN',
    'FALSE', 'FETCH', 'FLOAT', 'FLOAT4', 'FLOAT8', 'FOR', 'FORCE', 'FOREIGN',
    'FROM', 'FULLTEXT',
    'GRANT', 'GROUP',
    'HAVING', 'HIGH_PRIORITY', 'HOUR_MICROSECOND', 'HOUR_MINUTE', 'HOUR_SECOND',
    'IF', 'IGNORE', 'IN', 'INDEX', 'INFILE', 'INNER', 'INOUT', 'INSENSITIVE',
    'INSERT', 'INT', 'INT1', 'INT2', 'INT3', 'INT4', 'INT8', 'INTEGER',
    'INTERVAL', 'INTO', 'IO_AFTER_GTIDS', 'IO_BEFORE_GTIDS', 'IS', 'ITERATE',
    'JOIN',
    'KEY', 'KEYS', 'KILL',
    'LEADING', 'LEAVE', 'LEFT', 'LIKE', 'LIMIT', 'LINEAR', 'LINES', 'LOAD',
    'LOCALTIME', 'LOCALTIMESTAMP', 'LOCK', 'LONG', 'LONGBLOB', 'LONGTEXT',
    'LOOP', 'LOW_PRIORITY',
    'MASTER_BIND', 'MASTER_SSL_VERIFY_SERVER_CERT', 'MATCH', 'MAXVALUE',
    'MEDIUMBLOB', 'MEDIUMINT', 'MEDIUMTEXT', 'MIDDLEINT', 'MINUTE_MICROSECOND',
    'MINUTE_SECOND', 'MOD', 'MODIFIES',
    'NATURAL', 'NOT', 'NO_WRITE_TO_BINLOG', 'NULL', 'NUMERIC',
    'ON', 'OPTIMIZE', 'OPTION', 'OPTIONALLY', 'OR', 'ORDER', 'OUT', 'OUTER',
    'OUTFILE',
    'PARTITION', 'PRECISION', 'PRIMARY', 'PROCEDURE', 'PURGE',
    'RANGE', 'READ', 'READS', 'READ_WRITE', 'REAL', 'REFERENCES', 'REGEXP',
    'RELEASE', 'RENAME', 'REPEAT', 'REPLACE', 'REQUIRE', 'RESIGNAL', 'RESTRICT',
    'RETURN', 'REVOKE', 'RIGHT', 'RLIKE',
    'SCHEMA', 'SCHEMAS', 'SECOND_MICROSECOND', 'SELECT', 'SENSITIVE', 'SEPARATOR',
    'SET', 'SHOW', 'SIGNAL', 'SMALLINT', 'SPATIAL', 'SPECIFIC', 'SQL',
    'SQL_BIG_RESULT', 'SQL_CALC_FOUND_ROWS', 'SQL_SMALL_RESULT', 'SQLEXCEPTION',
    'SQLSTATE', 'SQLWARNING', 'SSL', 'STARTING', 'STRAIGHT_JOIN',
    'TABLE', 'TERMINATED', 'THEN', 'TINYBLOB', 'TINYINT', 'TINYTEXT', 'TO',
    'TRAILING', 'TRIGGER', 'TRUE',
    'UNDO', 'UNION', 'UNIQUE', 'UNLOCK', 'UNSIGNED', 'UPDATE', 'USAGE', 'USE',
    'USING', 'UTC_DATE', 'UTC_TIME', 'UTC_TIMESTAMP',
    'VALUES', 'VARBINARY', 'VARCHAR', 'VARCHARACTER', 'VARYING',
    'WHEN', 'WHERE', 'WHILE', 'WITH', 'WRITE',
    'XOR',
    'YEAR_MONTH',
    'ZEROFILL',
    'NAME', 'COMMENT', 'TYPE', 'EXTRA'
]);

// 检查标识符是否需要用反引号包裹
function needsBacktick(identifier) {
    if (!identifier) return false;
    const upperId = identifier.toUpperCase();
    if (MYSQL_RESERVED_WORDS.has(upperId)) return true;
    if (/^\d/.test(identifier)) return true;
    if (/[^a-zA-Z0-9_$]/.test(identifier)) return true;
    return false;
}

// 用反引号包裹标识符
function quoteIdentifier(identifier) {
    if (!identifier) return identifier;
    return '`' + identifier.replace(/`/g, '``') + '`';
}

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false
        },
        icon: path.join(__dirname, 'icon.png')
    });

    mainWindow.loadFile('index.html');

    // 开发环境下打开开发者工具
    if (process.env.NODE_ENV === 'development') {
        mainWindow.webContents.openDevTools();
    }
}

app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (dbConnection) {
        dbConnection.end();
    }
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// IPC通信：测试MySQL连接
ipcMain.handle('test-connection', async (event, config) => {
    try {
        const connection = await mysql.createConnection({
            host: config.host,
            port: config.port || 3306,
            user: config.user,
            password: config.password,
            connectTimeout: 5000
        });
        await connection.end();
        return { success: true, message: '连接成功' };
    } catch (error) {
        return { success: false, message: error.message };
    }
});

// IPC通信：连接MySQL数据库
ipcMain.handle('connect-database', async (event, config) => {
    try {
        // 关闭之前的连接
        if (dbConnection) {
            try {
                await dbConnection.end();
            } catch (e) {
                // 忽略关闭错误
            }
        }

        dbConnection = await mysql.createConnection({
            host: config.host,
            port: config.port || 3306,
            user: config.user,
            password: config.password,
            connectTimeout: 10000
        });

        return { success: true, message: '数据库连接成功' };
    } catch (error) {
        return { success: false, message: error.message };
    }
});

// IPC通信：断开数据库连接
ipcMain.handle('disconnect-database', async () => {
    try {
        if (dbConnection) {
            await dbConnection.end();
            dbConnection = null;
        }
        return { success: true, message: '已断开连接' };
    } catch (error) {
        return { success: false, message: error.message };
    }
});

// IPC通信：获取所有数据库
ipcMain.handle('get-databases', async () => {
    try {
        if (!dbConnection) {
            return { success: false, message: '未连接到数据库' };
        }

        const [rows] = await dbConnection.query(`
            SELECT schema_name as \`name\` 
            FROM information_schema.schemata 
            WHERE schema_name NOT IN ('information_schema', 'mysql', 'performance_schema', 'sys')
            ORDER BY schema_name
        `);

        return { success: true, data: rows };
    } catch (error) {
        return { success: false, message: error.message };
    }
});

// IPC通信：获取指定数据库的所有表
ipcMain.handle('get-tables', async (event, databaseName) => {
    try {
        if (!dbConnection) {
            return { success: false, message: '未连接到数据库' };
        }

        const [rows] = await dbConnection.query(`
            SELECT table_name as \`name\`, table_comment as \`comment\`
            FROM information_schema.tables 
            WHERE table_schema = ? 
            ORDER BY table_name
        `, [databaseName]);

        return { success: true, data: rows };
    } catch (error) {
        return { success: false, message: error.message };
    }
});

// IPC通信：获取表结构
ipcMain.handle('get-table-structure', async (event, databaseName, tableName) => {
    try {
        if (!dbConnection) {
            return { success: false, message: '未连接到数据库' };
        }

        const [columns] = await dbConnection.query(`
            SELECT 
                column_name as \`name\`,
                column_type as \`type\`,
                is_nullable as \`nullable\`,
                column_key as \`key\`,
                column_default as \`default\`,
                extra as \`extra\`,
                column_comment as \`comment\`
            FROM information_schema.columns 
            WHERE table_schema = ? AND table_name = ?
            ORDER BY ordinal_position
        `, [databaseName, tableName]);

        const [tableInfo] = await dbConnection.query(`
            SELECT table_comment as \`comment\`, table_rows as \`rows\`, data_length as \`size\`
            FROM information_schema.tables
            WHERE table_schema = ? AND table_name = ?
        `, [databaseName, tableName]);

        return {
            success: true,
            data: {
                columns: columns,
                tableInfo: tableInfo[0] || {}
            }
        };
    } catch (error) {
        return { success: false, message: error.message };
    }
});

// IPC通信：执行SQL查询
ipcMain.handle('execute-query', async (event, sql) => {
    try {
        if (!dbConnection) {
            return { success: false, message: '未连接到数据库' };
        }

        const [rows] = await dbConnection.query(sql);
        return { success: true, data: rows };
    } catch (error) {
        return { success: false, message: error.message };
    }
});

// IPC通信：获取表数据总行数
ipcMain.handle('get-table-row-count', async (event, databaseName, tableName) => {
    try {
        if (!dbConnection) {
            return { success: false, message: '未连接到数据库' };
        }

        const [rows] = await dbConnection.query(
            `SELECT COUNT(*) as total FROM ${quoteIdentifier(databaseName)}.${quoteIdentifier(tableName)}`
        );

        return { success: true, data: rows[0].total };
    } catch (error) {
        return { success: false, message: error.message };
    }
});

// IPC通信：获取表数据（分页）
ipcMain.handle('get-table-data', async (event, databaseName, tableName, limit = 100, offset = 0) => {
    try {
        if (!dbConnection) {
            return { success: false, message: '未连接到数据库' };
        }

        const [rows] = await dbConnection.query(
            `SELECT * FROM ${quoteIdentifier(databaseName)}.${quoteIdentifier(tableName)} LIMIT ? OFFSET ?`,
            [limit, offset]
        );

        return { success: true, data: rows };
    } catch (error) {
        return { success: false, message: error.message };
    }
});
