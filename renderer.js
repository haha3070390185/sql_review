// 状态管理
const state = {
    isConnected: false,
    currentDatabase: null,
    currentTable: null,
    databases: [],
    tables: [],
    tableStructure: null,
    tableData: [],
    totalRows: 0,
    currentPage: 1,
    pageSize: 100,
    totalPages: 0
};

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

// DOM元素
const elements = {
    host: document.getElementById('host'),
    port: document.getElementById('port'),
    user: document.getElementById('user'),
    password: document.getElementById('password'),
    testBtn: document.getElementById('testBtn'),
    connectBtn: document.getElementById('connectBtn'),
    connectionStatus: document.getElementById('connectionStatus'),
    databaseList: document.getElementById('databaseList'),
    tableList: document.getElementById('tableList'),
    tableStructure: document.getElementById('tableStructure'),
    tableData: document.getElementById('tableData'),
    currentDatabase: document.getElementById('currentDatabase'),
    currentTable: document.getElementById('currentTable'),
    refreshTablesBtn: document.getElementById('refreshTablesBtn'),
    refreshBtn: document.getElementById('refreshBtn'),
    exportBtn: document.getElementById('exportBtn'),
    toast: document.getElementById('toast'),
    // 选项卡相关
    structureTab: document.getElementById('structureTab'),
    dataTab: document.getElementById('dataTab'),
    // 数据分页相关
    dataCount: document.getElementById('dataCount'),
    pageInfo: document.getElementById('pageInfo'),
    prevPageBtn: document.getElementById('prevPageBtn'),
    nextPageBtn: document.getElementById('nextPageBtn'),
    pageSizeSelect: document.getElementById('pageSizeSelect')
};

// Toast提示
function showToast(message, type = 'info') {
    elements.toast.textContent = message;
    elements.toast.className = `toast show ${type}`;
    
    setTimeout(() => {
        elements.toast.classList.remove('show');
    }, 3000);
}

// 显示状态消息
function showStatus(message, type = 'info') {
    elements.connectionStatus.textContent = message;
    elements.connectionStatus.className = `status-message ${type}`;
}

// 清空状态消息
function clearStatus() {
    elements.connectionStatus.textContent = '';
    elements.connectionStatus.className = 'status-message';
}

// 获取连接配置
function getConnectionConfig() {
    return {
        host: elements.host.value.trim() || 'localhost',
        port: parseInt(elements.port.value) || 3306,
        user: elements.user.value.trim() || 'root',
        password: elements.password.value
    };
}

// 禁用/启用表单
function setFormEnabled(enabled) {
    elements.host.disabled = !enabled;
    elements.port.disabled = !enabled;
    elements.user.disabled = !enabled;
    elements.password.disabled = !enabled;
    elements.testBtn.disabled = !enabled;
    
    if (enabled) {
        elements.connectBtn.textContent = '连接数据库';
        elements.connectBtn.classList.remove('btn-success');
        elements.connectBtn.classList.add('btn-primary');
    } else {
        elements.connectBtn.textContent = '断开连接';
        elements.connectBtn.classList.remove('btn-primary');
        elements.connectBtn.classList.add('btn-success');
    }
}

// 测试连接
async function testConnection() {
    const config = getConnectionConfig();
    if (!config.user) {
        showToast('请输入用户名', 'error');
        return;
    }
    
    showStatus('正在测试连接...', 'info');
    elements.testBtn.disabled = true;
    
    try {
        const result = await window.electronAPI.testConnection(config);
        
        if (result.success) {
            showStatus('连接测试成功！', 'success');
            showToast('连接测试成功', 'success');
        } else {
            showStatus(`连接失败: ${result.message}`, 'error');
            showToast(`连接失败: ${result.message}`, 'error');
        }
    } catch (error) {
        showStatus(`连接失败: ${error.message}`, 'error');
        showToast(`连接失败: ${error.message}`, 'error');
    } finally {
        elements.testBtn.disabled = false;
    }
}

// 连接/断开数据库
async function toggleConnection() {
    if (state.isConnected) {
        // 断开连接
        try {
            await window.electronAPI.disconnectDatabase();
            state.isConnected = false;
            state.currentDatabase = null;
            state.currentTable = null;
            state.databases = [];
            state.tables = [];
            state.tableStructure = null;
            
            setFormEnabled(true);
            clearStatus();
            renderDatabaseList();
            renderTableList();
            renderTableStructure();
            
            elements.refreshTablesBtn.disabled = true;
            elements.refreshStructureBtn.disabled = true;
            elements.exportBtn.disabled = true;
            
            showToast('已断开数据库连接', 'info');
        } catch (error) {
            showToast(`断开连接失败: ${error.message}`, 'error');
        }
    } else {
        // 连接数据库
        const config = getConnectionConfig();
        if (!config.user) {
            showToast('请输入用户名', 'error');
            return;
        }
        
        showStatus('正在连接数据库...', 'info');
        elements.connectBtn.disabled = true;
        
        try {
            const result = await window.electronAPI.connectDatabase(config);
            
            if (result.success) {
                state.isConnected = true;
                showStatus('数据库连接成功！', 'success');
                showToast('数据库连接成功', 'success');
                setFormEnabled(false);
                
                // 加载数据库列表
                await loadDatabases();
            } else {
                showStatus(`连接失败: ${result.message}`, 'error');
                showToast(`连接失败: ${result.message}`, 'error');
            }
        } catch (error) {
            showStatus(`连接失败: ${error.message}`, 'error');
            showToast(`连接失败: ${error.message}`, 'error');
        } finally {
            elements.connectBtn.disabled = false;
        }
    }
}

// 加载数据库列表
async function loadDatabases() {
    if (!state.isConnected) return;
    
    try {
        const result = await window.electronAPI.getDatabases();
        
        if (result.success) {
            state.databases = result.data || [];
            renderDatabaseList();
        } else {
            showToast(`加载数据库失败: ${result.message}`, 'error');
        }
    } catch (error) {
        showToast(`加载数据库失败: ${error.message}`, 'error');
    }
}

// 渲染数据库列表
function renderDatabaseList() {
    if (state.databases.length === 0) {
        elements.databaseList.innerHTML = '<p class="empty-message">未找到数据库</p>';
        return;
    }
    
    let html = '';
    state.databases.forEach(db => {
        const isActive = state.currentDatabase === db.name;
        html += `<div class="list-item database ${isActive ? 'active' : ''}" data-database="${db.name}">${db.name}</div>`;
    });
    
    elements.databaseList.innerHTML = html;
    
    // 添加点击事件
    elements.databaseList.querySelectorAll('.list-item').forEach(item => {
        item.addEventListener('click', () => {
            selectDatabase(item.dataset.database);
        });
    });
}

// 选择数据库
async function selectDatabase(databaseName) {
    if (state.currentDatabase === databaseName) return;
    
    state.currentDatabase = databaseName;
    state.currentTable = null;
    state.tables = [];
    state.tableStructure = null;
    
    elements.currentDatabase.textContent = `表列表 - ${databaseName}`;
    elements.refreshTablesBtn.disabled = false;
    
    renderDatabaseList();
    renderTableList();
    renderTableStructure();
    
    // 加载表列表
    await loadTables(databaseName);
}

// 加载表列表
async function loadTables(databaseName) {
    if (!state.isConnected) return;
    
    try {
        const result = await window.electronAPI.getTables(databaseName);
        
        if (result.success) {
            state.tables = result.data || [];
            renderTableList();
        } else {
            showToast(`加载表失败: ${result.message}`, 'error');
        }
    } catch (error) {
        showToast(`加载表失败: ${error.message}`, 'error');
    }
}

// 渲染表列表
function renderTableList() {
    if (state.tables.length === 0) {
        elements.tableList.innerHTML = '<p class="empty-message">请先选择数据库</p>';
        return;
    }
    
    let html = '';
    state.tables.forEach(table => {
        const isActive = state.currentTable === table.name;
        const displayName = table.comment ? `${table.name} (${table.comment})` : table.name;
        html += `<div class="list-item table ${isActive ? 'active' : ''}" data-table="${table.name}" title="${table.comment || ''}">${displayName}</div>`;
    });
    
    elements.tableList.innerHTML = html;
    
    // 添加点击事件
    elements.tableList.querySelectorAll('.list-item').forEach(item => {
        item.addEventListener('click', () => {
            selectTable(item.dataset.table);
        });
    });
}

// 选择表
async function selectTable(tableName) {
    if (state.currentTable === tableName) return;
    
    state.currentTable = tableName;
    state.tableStructure = null;
    state.tableData = [];
    state.totalRows = 0;
    state.currentPage = 1;
    state.totalPages = 0;
    
    elements.currentTable.textContent = `表详情 - ${tableName}`;
    elements.refreshBtn.disabled = false;
    elements.exportBtn.disabled = false;
    
    renderTableList();
    
    // 加载表结构
    await loadTableStructure(state.currentDatabase, tableName);
    
    // 加载表数据
    await loadTableData();
}

// 加载表数据
async function loadTableData() {
    if (!state.isConnected || !state.currentDatabase || !state.currentTable) {
        return;
    }
    
    try {
        // 先获取总行数
        const countResult = await window.electronAPI.getTableRowCount(
            state.currentDatabase, 
            state.currentTable
        );
        
        if (countResult.success) {
            state.totalRows = countResult.data;
            state.totalPages = Math.ceil(state.totalRows / state.pageSize);
            if (state.totalPages === 0 && state.totalRows > 0) {
                state.totalPages = 1;
            }
            if (state.currentPage > state.totalPages && state.totalPages > 0) {
                state.currentPage = state.totalPages;
            }
        }
        
        // 然后获取分页数据
        const offset = (state.currentPage - 1) * state.pageSize;
        const dataResult = await window.electronAPI.getTableData(
            state.currentDatabase, 
            state.currentTable, 
            state.pageSize, 
            offset
        );
        
        if (dataResult.success) {
            state.tableData = dataResult.data || [];
            renderTableData();
            updatePagination();
        } else {
            showToast(`加载表数据失败: ${dataResult.message}`, 'error');
        }
    } catch (error) {
        showToast(`加载表数据失败: ${error.message}`, 'error');
    }
}

// 渲染表数据
function renderTableData() {
    if (!state.tableData || state.tableData.length === 0) {
        if (state.totalRows === 0) {
            elements.tableData.innerHTML = '<p class="empty-message">该表没有数据</p>';
        } else {
            elements.tableData.innerHTML = '<p class="empty-message">请先选择表</p>';
        }
        return;
    }
    
    // 获取列名
    const columns = Object.keys(state.tableData[0]);
    
    // 构建表格HTML
    let html = '<table class="data-table"><thead><tr>';
    
    // 表头
    columns.forEach(col => {
        html += `<th>${escapeHtml(col)}</th>`;
    });
    
    html += '</tr></thead><tbody>';
    
    // 表数据
    state.tableData.forEach(row => {
        html += '<tr>';
        columns.forEach(col => {
            let value = row[col];
            if (value === null) {
                html += '<td class="null-value">NULL</td>';
            } else if (typeof value === 'object') {
                // 处理Blob或其他对象类型
                html += `<td class="binary-data">[Binary Data]</td>`;
            } else {
                html += `<td>${escapeHtml(String(value))}</td>`;
            }
        });
        html += '</tr>';
    });
    
    html += '</tbody></table>';
    
    elements.tableData.innerHTML = html;
}

// HTML转义函数
function escapeHtml(text) {
    if (text === null || text === undefined) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// 更新分页信息
function updatePagination() {
    elements.dataCount.textContent = `共 ${state.totalRows} 条数据`;
    
    if (state.totalPages === 0) {
        elements.pageInfo.textContent = '第 0 页';
    } else {
        elements.pageInfo.textContent = `第 ${state.currentPage} / ${state.totalPages} 页`;
    }
    
    // 更新按钮状态
    elements.prevPageBtn.disabled = state.currentPage <= 1;
    elements.nextPageBtn.disabled = state.currentPage >= state.totalPages || state.totalPages === 0;
}

// 上一页
function prevPage() {
    if (state.currentPage > 1) {
        state.currentPage--;
        loadTableData();
    }
}

// 下一页
function nextPage() {
    if (state.currentPage < state.totalPages) {
        state.currentPage++;
        loadTableData();
    }
}

// 切换分页大小
function changePageSize(size) {
    state.pageSize = parseInt(size);
    state.currentPage = 1;
    loadTableData();
}

// 选项卡切换
function switchTab(tabName) {
    // 移除所有激活状态
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    
    // 激活选中的选项卡
    document.querySelector(`.tab-btn[data-tab="${tabName}"]`).classList.add('active');
    document.getElementById(`${tabName}Tab`).classList.add('active');
}

// 刷新当前选项卡内容
async function refreshCurrentTab() {
    if (!state.currentDatabase || !state.currentTable) {
        showToast('请先选择表', 'error');
        return;
    }
    
    const activeTabBtn = document.querySelector('.tab-btn.active');
    const tabName = activeTabBtn ? activeTabBtn.dataset.tab : 'structure';
    
    if (tabName === 'structure') {
        await loadTableStructure(state.currentDatabase, state.currentTable);
        showToast('表结构已刷新', 'success');
    } else {
        await loadTableData();
        showToast('表数据已刷新', 'success');
    }
}

// 加载表结构
async function loadTableStructure(databaseName, tableName) {
    if (!state.isConnected) return;
    
    try {
        const result = await window.electronAPI.getTableStructure(databaseName, tableName);
        
        if (result.success) {
            state.tableStructure = result.data;
            renderTableStructure();
        } else {
            showToast(`加载表结构失败: ${result.message}`, 'error');
        }
    } catch (error) {
        showToast(`加载表结构失败: ${error.message}`, 'error');
    }
}

// 渲染表结构
function renderTableStructure() {
    if (!state.tableStructure || !state.tableStructure.columns) {
        elements.tableStructure.innerHTML = '<p class="empty-message">请先选择表</p>';
        return;
    }
    
    const { columns, tableInfo } = state.tableStructure;
    
    // 表信息
    let tableInfoHtml = `
        <div class="table-info">
            <h4>${state.currentTable}</h4>
            ${tableInfo.comment ? `<div class="comment">${tableInfo.comment}</div>` : ''}
            <div class="stats">
                <span>字段数: <strong>${columns.length}</strong></span>
                ${tableInfo.rows !== undefined ? `<span>行数: <strong>${tableInfo.rows}</strong></span>` : ''}
                ${tableInfo.size !== undefined ? `<span>大小: <strong>${formatBytes(tableInfo.size)}</strong></span>` : ''}
            </div>
        </div>
    `;
    
    // 表结构表格
    let tableHtml = `
        <table class="structure-table">
            <thead>
                <tr>
                    <th>字段名</th>
                    <th>类型</th>
                    <th>主键</th>
                    <th>可空</th>
                    <th>默认值</th>
                    <th>额外</th>
                    <th>备注</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    columns.forEach(col => {
        const keyClass = col.key === 'PRI' ? 'primary' : (col.key === 'UNI' ? 'unique' : (col.key === 'MUL' ? 'index' : ''));
        const nullableClass = col.nullable === 'YES' ? 'yes' : 'no';
        
        tableHtml += `
            <tr>
                <td class="col-name">${col.name}</td>
                <td><span class="col-type">${col.type}</span></td>
                <td>${col.key ? `<span class="col-key ${keyClass}">${col.key === 'PRI' ? 'PK' : (col.key === 'UNI' ? 'UN' : 'IDX')}</span>` : ''}</td>
                <td class="col-nullable ${nullableClass}">${col.nullable === 'YES' ? '是' : '否'}</td>
                <td class="col-default">${col.default !== null ? col.default : '-'}</td>
                <td class="col-extra">${col.extra || '-'}</td>
                <td class="col-comment" title="${col.comment || ''}">${col.comment || '-'}</td>
            </tr>
        `;
    });
    
    tableHtml += `
            </tbody>
        </table>
    `;
    
    elements.tableStructure.innerHTML = tableInfoHtml + tableHtml;
}

// 格式化字节大小
function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

// 生成简单的表结构DDL
function generateSimpleDDL(databaseName, tableName, columns) {
    let ddl = `-- 数据库: ${databaseName}\n`;
    ddl += `-- 表: ${tableName}\n`;
    ddl += `-- 生成时间: ${new Date().toLocaleString()}\n\n`;
    
    ddl += `CREATE TABLE ${quoteIdentifier(tableName)} (\n`;
    
    const columnDefs = [];
    const primaryKeys = [];
    
    columns.forEach(col => {
        let def = `  ${quoteIdentifier(col.name)} ${col.type}`;
        
        if (col.nullable === 'NO' && col.key !== 'PRI') {
            def += ' NOT NULL';
        }
        
        if (col.default !== null && col.default !== undefined) {
            if (col.default === 'CURRENT_TIMESTAMP') {
                def += ` DEFAULT ${col.default}`;
            } else {
                def += ` DEFAULT '${col.default}'`;
            }
        }
        
        if (col.extra) {
            def += ` ${col.extra}`;
        }
        
        columnDefs.push(def);
        
        if (col.key === 'PRI') {
            primaryKeys.push(col.name);
        }
    });
    
    ddl += columnDefs.join(',\n');
    
    if (primaryKeys.length > 0) {
        const quotedKeys = primaryKeys.map(k => quoteIdentifier(k));
        ddl += `,\n  PRIMARY KEY (${quotedKeys.join(', ')})`;
    }
    
    ddl += '\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;\n';
    
    return ddl;
}

// 导出表结构
function exportTableStructure() {
    if (!state.tableStructure || !state.currentDatabase || !state.currentTable) {
        showToast('请先选择表', 'error');
        return;
    }
    
    const { columns, tableInfo } = state.tableStructure;
    
    // 生成简单的DDL
    const ddl = generateSimpleDDL(state.currentDatabase, state.currentTable, columns);
    
    // 复制到剪贴板
    navigator.clipboard.writeText(ddl).then(() => {
        showToast('表结构已复制到剪贴板', 'success');
    }).catch(() => {
        // 如果复制失败，显示在控制台
        console.log(ddl);
        showToast('已生成表结构（查看控制台）', 'info');
    });
    
    // 同时也可以显示在一个模态框中，但为了简单，先复制到剪贴板
}

// 事件监听
function initEventListeners() {
    // 测试连接按钮
    elements.testBtn.addEventListener('click', testConnection);
    
    // 连接/断开按钮
    elements.connectBtn.addEventListener('click', toggleConnection);
    
    // 回车键连接
    elements.password.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            toggleConnection();
        }
    });
    
    // 刷新表列表
    elements.refreshTablesBtn.addEventListener('click', async () => {
        if (state.currentDatabase) {
            await loadTables(state.currentDatabase);
            showToast('表列表已刷新', 'success');
        }
    });
    
    // 刷新按钮（根据当前选项卡刷新）
    elements.refreshBtn.addEventListener('click', refreshCurrentTab);
    
    // 导出表结构
    elements.exportBtn.addEventListener('click', exportTableStructure);
    
    // 选项卡切换
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            switchTab(btn.dataset.tab);
        });
    });
    
    // 分页按钮
    elements.prevPageBtn.addEventListener('click', prevPage);
    elements.nextPageBtn.addEventListener('click', nextPage);
    
    // 分页大小选择
    elements.pageSizeSelect.addEventListener('change', (e) => {
        changePageSize(e.target.value);
    });
}

// 初始化
function init() {
    initEventListeners();
    console.log('MySQL可视化工具已启动');
}

// 启动应用
init();
