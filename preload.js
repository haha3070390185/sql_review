const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    // 测试连接
    testConnection: (config) => ipcRenderer.invoke('test-connection', config),
    
    // 连接数据库
    connectDatabase: (config) => ipcRenderer.invoke('connect-database', config),
    
    // 断开连接
    disconnectDatabase: () => ipcRenderer.invoke('disconnect-database'),
    
    // 获取所有数据库
    getDatabases: () => ipcRenderer.invoke('get-databases'),
    
    // 获取指定数据库的所有表
    getTables: (databaseName) => ipcRenderer.invoke('get-tables', databaseName),
    
    // 获取表结构
    getTableStructure: (databaseName, tableName) => ipcRenderer.invoke('get-table-structure', databaseName, tableName),
    
    // 执行SQL查询
    executeQuery: (sql) => ipcRenderer.invoke('execute-query', sql)
});
