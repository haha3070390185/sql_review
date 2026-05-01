const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const mysql = require('mysql2/promise');

let mainWindow;
let dbConnection = null;

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
            SELECT schema_name as name 
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
            SELECT table_name as name, table_comment as comment
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
                column_name as name,
                column_type as type,
                is_nullable as nullable,
                column_key as key,
                column_default as default,
                extra as extra,
                column_comment as comment
            FROM information_schema.columns 
            WHERE table_schema = ? AND table_name = ?
            ORDER BY ordinal_position
        `, [databaseName, tableName]);

        const [tableInfo] = await dbConnection.query(`
            SELECT table_comment as comment, table_rows as rows, data_length as size
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
