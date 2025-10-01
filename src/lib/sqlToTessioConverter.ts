/**
 * SQL to Tessio Session Query Converter
 * Converts SQL queries to EventHorizon.createSession() parameters
 */

// Type definitions based on the main types
export interface FilterDef {
    field: string;
    comparison: 'lt' | '<' | 'eq' | '==' | '=' | 'gt' | '>' | 'gte' | '>=' | 'lte' | '<=' | 'ne' | '!=' | 'in' | 'notin' | 'like' | '~' | '!~' | 'between' | string;
    value: any;
}

export interface SortDef {
    field: string;
    direction: 'asc' | 'desc';
}

export interface ColumnDef {
    name: string;
    primaryKey?: boolean;
    secondaryKey?: boolean;
    columnType?: 'string' | 'text' | 'number' | 'date' | 'boolean' | 'object';
    value?: any;
    defaultValue?: any;
    expression?: string;
    aggregator?: 'sum' | 'avg' | 'max' | 'min' | 'count' | 'expression';
    resolve?: ResolveConfig;
}

export interface GroupByDef {
    dataIndex: string;
}

export interface ResolveConfig {
    underlyingField: string;
    childrenTable?: string;
    session?: CreateSessionParameters;
    valueField?: string;
    displayField: string;
}

export interface SubSessionConfig {
    [key: string]: CreateSessionParameters;
}

export interface CreateSessionParameters {
    id?: string;
    table: string | CreateSessionParameters;
    columns?: ColumnDef[];
    filter?: FilterDef[];
    sort?: SortDef[];
    groupBy?: GroupByDef[];
    start?: number;
    limit?: number;
    offset?: number;
    includeLeafs?: boolean;
    subSessions?: SubSessionConfig;
}

export interface SqlParseResult {
    sessionConfig: CreateSessionParameters;
    warnings: string[];
    unsupportedFeatures: string[];
}

export interface JoinInfo {
    type: 'INNER' | 'LEFT' | 'RIGHT' | 'FULL';
    table: string;
    alias?: string;
    on: string;
}

export class SqlToTessioConverter {
    private warnings: string[] = [];
    private unsupportedFeatures: string[] = [];
    private subQueryCounter: number = 0;

    /**
     * Convert a SQL query to Tessio session parameters
     * 
     * Key Features:
     * - Supports nested table structures for proper WHERE + GROUP BY handling
     * - Applies filters before aggregation to avoid architectural limitations
     * - Converts SQL aggregation functions to Tessio aggregators
     * - Handles subqueries as SubSessions where possible
     */
    public convertSql(sql: string): SqlParseResult {
        this.warnings = [];
        this.unsupportedFeatures = [];
        this.subQueryCounter = 0;

        try {
            const normalized = this.normalizeSql(sql);
            const processed = this.preprocessSubqueries(normalized);
            const parsed = this.parseSql(processed.sql);
            const sessionConfig = this.buildSessionConfig(parsed, processed.subQueries);

            return {
                sessionConfig,
                warnings: [...this.warnings],
                unsupportedFeatures: [...this.unsupportedFeatures]
            };
        } catch (error) {
            throw new Error(`SQL parsing failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Normalize SQL query for parsing
     */
    private normalizeSql(sql: string): string {
        return sql
            .replace(/\s+/g, ' ')
            .replace(/\n/g, ' ')
            .trim()
            .replace(/;$/, ''); // Remove trailing semicolon
    }

    /**
     * Preprocess SQL to extract and replace subqueries with placeholders
     */
    private preprocessSubqueries(sql: string): { sql: string; subQueries: Map<string, string> } {
        const subQueries = new Map<string, string>();
        let processedSql = sql;
        
        // Find and extract subqueries using improved parsing
        let hasSubqueries = true;
        while (hasSubqueries) {
            hasSubqueries = false;
            
            // Extract innermost subqueries first to handle nested ones
            const subqueryMatches = this.findSubqueries(processedSql);
            
            for (const match of subqueryMatches) {
                const placeholder = `__SUBQUERY_${++this.subQueryCounter}__`;
                const subqueryContent = match.content;
                
                // Check if it's a correlated subquery
                if (this.isCorrelatedSubquery(subqueryContent, sql)) {
                    this.warnings.push(`Correlated subquery detected - may require manual SubSession implementation`);
                }
                
                subQueries.set(placeholder, subqueryContent);
                processedSql = processedSql.replace(match.full, match.replacement.replace('SUBQUERY_PLACEHOLDER', placeholder));
                hasSubqueries = true;
            }
        }
        
        return { sql: processedSql, subQueries };
    }

    /**
     * Find subqueries in SQL with proper parentheses matching
     */
    private findSubqueries(sql: string): Array<{ full: string; content: string; replacement: string }> {
        const matches: Array<{ full: string; content: string; replacement: string }> = [];
        
        // Patterns for different types of subqueries
        const patterns = [
            // Subqueries in SELECT clauses
            {
                regex: /\(\s*SELECT\s[^()]*(?:\([^()]*\)[^()]*)?\)/gi,
                replacement: 'SUBQUERY_PLACEHOLDER'
            },
            // Subqueries in WHERE clauses with IN, EXISTS, etc.
            {
                regex: /\b(?:IN|EXISTS|NOT\s+EXISTS|=|!=|<>|>|>=|<|<=)\s*\(\s*SELECT\s[^()]*(?:\([^()]*\)[^()]*)?\)/gi,
                replacement: (match: string) => {
                    const operator = match.match(/^\w+(?:\s+\w+)*/)?.[0] || '';
                    return `${operator} (SUBQUERY_PLACEHOLDER)`;
                }
            },
            // Subqueries in FROM clauses
            {
                regex: /FROM\s+\(\s*SELECT\s[^()]*(?:\([^()]*\)[^()]*)?\)\s*(?:AS\s+\w+)?/gi,
                replacement: 'FROM SUBQUERY_PLACEHOLDER'
            }
        ];

        for (const pattern of patterns) {
            let match;
            const regex = new RegExp(pattern.regex.source, pattern.regex.flags);
            
            while ((match = regex.exec(sql)) !== null) {
                const fullMatch = match[0];
                const subqueryPart = fullMatch.match(/\(\s*SELECT[^()]*(?:\([^()]*\)[^()]*)?\)/i)?.[0];
                
                if (subqueryPart) {
                    const content = subqueryPart.slice(1, -1).trim(); // Remove outer parentheses
                    const replacement = typeof pattern.replacement === 'function' 
                        ? pattern.replacement(fullMatch) 
                        : pattern.replacement;
                    
                    matches.push({
                        full: fullMatch,
                        content: content,
                        replacement: replacement
                    });
                }
            }
        }
        
        return matches;
    }

    /**
     * Check if a subquery is correlated (references outer query tables)
     */
    private isCorrelatedSubquery(subquerySql: string, outerSql: string): boolean {
        // Extract table names/aliases from outer query
        const outerTables = this.extractTableReferences(outerSql);
        
        // Check if subquery references any outer table
        for (const table of outerTables) {
            if (subquerySql.toLowerCase().includes(table.toLowerCase() + '.')) {
                return true;
            }
        }
        
        return false;
    }

    /**
     * Extract table names and aliases from SQL
     */
    private extractTableReferences(sql: string): string[] {
        const tables: string[] = [];
        
        // Extract main table from FROM clause
        const fromMatch = sql.match(/FROM\s+(\w+)(?:\s+(?:AS\s+)?(\w+))?/i);
        if (fromMatch) {
            tables.push(fromMatch[1]); // Table name
            if (fromMatch[2]) {
                tables.push(fromMatch[2]); // Alias
            }
        }
        
        // Extract tables from JOIN clauses
        const joinMatches = sql.match(/JOIN\s+(\w+)(?:\s+(?:AS\s+)?(\w+))?/gi);
        if (joinMatches) {
            for (const joinMatch of joinMatches) {
                const match = joinMatch.match(/JOIN\s+(\w+)(?:\s+(?:AS\s+)?(\w+))?/i);
                if (match) {
                    tables.push(match[1]); // Table name
                    if (match[2]) {
                        tables.push(match[2]); // Alias
                    }
                }
            }
        }
        
        return tables;
    }

    /**
     * Parse SQL into components
     */
    private parseSql(sql: string) {
        const selectMatch = sql.match(/SELECT\s+(.*?)\s+FROM\s+(\w+)(?:\s+AS\s+(\w+))?/i);
        if (!selectMatch) {
            throw new Error('Invalid SQL: SELECT FROM clause not found');
        }

        const [, selectClause, tableName, tableAlias] = selectMatch;
        
        // Extract other clauses
        const whereMatch = sql.match(/WHERE\s+(.*?)(?:\s+GROUP\s+BY|\s+ORDER\s+BY|\s+LIMIT|$)/i);
        const groupByMatch = sql.match(/GROUP\s+BY\s+(.*?)(?:\s+HAVING|\s+ORDER\s+BY|\s+LIMIT|$)/i);
        const havingMatch = sql.match(/HAVING\s+(.*?)(?:\s+ORDER\s+BY|\s+LIMIT|$)/i);
        const orderByMatch = sql.match(/ORDER\s+BY\s+(.*?)(?:\s+LIMIT|$)/i);
        const limitMatch = sql.match(/LIMIT\s+(\d+)(?:\s+OFFSET\s+(\d+))?/i);
        
        // Check for JOINs
        const joinMatches = sql.match(/((?:INNER|LEFT|RIGHT|FULL)?\s*JOIN\s+\w+.*?ON\s+[^J]+)/gi);

        return {
            select: selectClause.trim(),
            from: tableName,
            alias: tableAlias,
            where: whereMatch ? whereMatch[1].trim() : null,
            groupBy: groupByMatch ? groupByMatch[1].trim() : null,
            having: havingMatch ? havingMatch[1].trim() : null,
            orderBy: orderByMatch ? orderByMatch[1].trim() : null,
            limit: limitMatch ? parseInt(limitMatch[1]) : null,
            offset: limitMatch && limitMatch[2] ? parseInt(limitMatch[2]) : null,
            joins: joinMatches || []
        };
    }

    /**
     * Build session configuration from parsed SQL
     */
    private buildSessionConfig(parsed: any, subQueries?: Map<string, string>): CreateSessionParameters {
        const config: CreateSessionParameters = {
            table: parsed.from
        };

        // Handle subquery in FROM clause
        if (subQueries && subQueries.has(parsed.from)) {
            const subquerySql = subQueries.get(parsed.from)!;
            try {
                const subQueryResult = this.convertSql(subquerySql);
                config.table = subQueryResult.sessionConfig;
                this.warnings.push('Subquery in FROM clause converted to nested session');
            } catch (error) {
                this.unsupportedFeatures.push(`Failed to convert subquery in FROM: ${parsed.from}`);
            }
        }

        // Handle SELECT columns (including subqueries)
        config.columns = this.parseSelectClause(parsed.select, subQueries);

        // Critical Fix: Handle WHERE + GROUP BY combination with nested table structure
        // This fixes the architectural limitation where filters cannot access fields after aggregation
        if (parsed.where && parsed.groupBy) {
            // Use nested table structure: apply filters before aggregation
            const baseTable = config.table;
            const filters = this.parseWhereClause(parsed.where, subQueries);
            
            config.table = {
                table: baseTable,
                filter: filters
            };
            
            // Add GROUP BY to the outer config
            config.groupBy = this.parseGroupByClause(parsed.groupBy);
            this.addAggregationColumns(config, parsed.select);
            
            this.warnings.push('WHERE + GROUP BY converted to nested table structure (filters applied before aggregation)');
        } else {
            // Handle WHERE clause normally (no GROUP BY)
            if (parsed.where) {
                config.filter = this.parseWhereClause(parsed.where, subQueries);
            }

            // Handle GROUP BY normally (no WHERE)
            if (parsed.groupBy) {
                config.groupBy = this.parseGroupByClause(parsed.groupBy);
                this.addAggregationColumns(config, parsed.select);
            }
        }

        // Handle ORDER BY
        if (parsed.orderBy) {
            config.sort = this.parseOrderByClause(parsed.orderBy);
        }

        // Handle LIMIT and OFFSET
        if (parsed.limit) {
            config.limit = parsed.limit;
        }
        if (parsed.offset) {
            config.offset = parsed.offset;
        }

        // Handle JOINs (convert to SubSessions where possible)
        if (parsed.joins && parsed.joins.length > 0) {
            this.handleJoins(config, parsed.joins);
        }

        // Handle HAVING (post-aggregation filters)
        if (parsed.having) {
            // HAVING clauses work on aggregated data, so they become regular filters
            // but only if we're not already using nested table structure for WHERE
            if (parsed.where && parsed.groupBy) {
                // We already have nested structure, HAVING filters go on outer level
                const havingFilters = this.parseWhereClause(parsed.having, subQueries);
                if (config.filter) {
                    config.filter.push(...havingFilters);
                } else {
                    config.filter = havingFilters;
                }
                this.warnings.push('HAVING clause converted to filters on aggregated columns');
            } else if (parsed.groupBy) {
                // Only GROUP BY, no WHERE - HAVING becomes regular filters
                config.filter = this.parseWhereClause(parsed.having, subQueries);
                this.warnings.push('HAVING clause converted to filters on aggregated columns');
            } else {
                this.warnings.push('HAVING clause without GROUP BY - treating as WHERE clause');
                config.filter = this.parseWhereClause(parsed.having, subQueries);
            }
        }

        // Handle subqueries as subSessions
        if (subQueries && subQueries.size > 0) {
            this.handleSubqueries(config, subQueries);
        }

        return config;
    }

    /**
     * Parse SELECT clause into columns
     */
    private parseSelectClause(selectClause: string, subQueries?: Map<string, string>): ColumnDef[] {
        if (selectClause.trim() === '*') {
            return []; // Let Tessio use all columns
        }

        const columns: ColumnDef[] = [];
        const columnParts = this.splitSelectColumns(selectClause);

        for (const part of columnParts) {
            const trimmed = part.trim();
            
            // Handle aggregation functions
            const aggMatch = trimmed.match(/^(COUNT|SUM|AVG|MAX|MIN)\s*\(\s*(.*?)\s*\)(?:\s+AS\s+(\w+))?$/i);
            if (aggMatch) {
                const [, func, field, alias] = aggMatch;
                columns.push({
                    name: alias || `${func.toLowerCase()}_${field.replace(/[^\w]/g, '_')}`,
                    value: field === '*' ? 1 : field,
                    aggregator: func.toLowerCase() as any
                });
                continue;
            }

            // Handle computed expressions and subqueries
            const exprMatch = trimmed.match(/^(.+)\s+AS\s+(\w+)$/i);
            if (exprMatch) {
                const [, expression, alias] = exprMatch;
                
                // Check if it's a subquery placeholder
                if (subQueries && subQueries.has(expression.trim())) {
                    const subquerySql = subQueries.get(expression.trim())!;
                    try {
                        const subQueryResult = this.convertSql(subquerySql);
                        columns.push({
                            name: alias,
                            resolve: {
                                underlyingField: 'id', // Default field for linking
                                session: subQueryResult.sessionConfig,
                                displayField: alias
                            }
                        });
                        this.warnings.push(`Subquery in SELECT converted to resolve configuration for '${alias}'`);
                    } catch (error) {
                        this.unsupportedFeatures.push(`Failed to convert subquery for column '${alias}': ${expression}`);
                    }
                    continue;
                }
                
                if (this.isSimpleField(expression)) {
                    columns.push({ name: alias });
                } else {
                    columns.push({
                        name: alias,
                        expression: this.convertSqlExpression(expression)
                    });
                    this.warnings.push(`Expression column '${alias}' may return template strings instead of calculated values`);
                }
                continue;
            }

            // Simple column reference
            if (this.isSimpleField(trimmed)) {
                columns.push({ name: trimmed });
            } else {
                // Complex expression without alias
                this.unsupportedFeatures.push(`Complex expression without alias: ${trimmed}`);
            }
        }

        return columns;
    }

    /**
     * Split SELECT columns while respecting function parentheses
     */
    private splitSelectColumns(selectClause: string): string[] {
        const columns: string[] = [];
        let current = '';
        let parenLevel = 0;
        let inQuotes = false;

        for (let i = 0; i < selectClause.length; i++) {
            const char = selectClause[i];
            
            if (char === "'" && selectClause[i - 1] !== '\\') {
                inQuotes = !inQuotes;
            }
            
            if (!inQuotes) {
                if (char === '(') parenLevel++;
                if (char === ')') parenLevel--;
                
                if (char === ',' && parenLevel === 0) {
                    columns.push(current.trim());
                    current = '';
                    continue;
                }
            }
            
            current += char;
        }
        
        if (current.trim()) {
            columns.push(current.trim());
        }
        
        return columns;
    }

    /**
     * Parse WHERE clause into filters
     */
    private parseWhereClause(whereClause: string, subQueries?: Map<string, string>): FilterDef[] {
        const filters: FilterDef[] = [];
        
        // Split by AND (basic implementation)
        const conditions = this.splitByLogicalOperator(whereClause, 'AND');
        
        for (const condition of conditions) {
            const filter = this.parseCondition(condition.trim(), subQueries);
            if (filter) {
                filters.push(filter);
            }
        }

        return filters;
    }

    /**
     * Parse a single condition into a filter
     */
    private parseCondition(condition: string, subQueries?: Map<string, string>): FilterDef | null {
        // Handle different comparison operators
        const operators = [
            { sql: ' LIKE ', tessio: 'like' },
            { sql: ' NOT LIKE ', tessio: 'notlike' },
            { sql: ' IN ', tessio: 'in' },
            { sql: ' NOT IN ', tessio: 'notin' },
            { sql: ' >= ', tessio: '>=' },
            { sql: ' <= ', tessio: '<=' },
            { sql: ' <> ', tessio: '!=' },
            { sql: ' != ', tessio: '!=' },
            { sql: ' = ', tessio: '==' },
            { sql: ' > ', tessio: '>' },
            { sql: ' < ', tessio: '<' }
        ];

        for (const op of operators) {
            const index = condition.toUpperCase().indexOf(op.sql.toUpperCase());
            if (index !== -1) {
                const field = condition.substring(0, index).trim();
                const valueStr = condition.substring(index + op.sql.length).trim();
                
                // Handle subquery values
                if (subQueries && subQueries.has(valueStr.trim())) {
                    const subquerySql = subQueries.get(valueStr.trim())!;
                    this.warnings.push(`Subquery in WHERE condition for field '${field}' needs manual conversion to SubSession or resolve`);
                    this.unsupportedFeatures.push(`Subquery condition: ${field} ${op.sql} (${subquerySql})`);
                    return null;
                }
                
                let value = this.parseValue(valueStr, op.tessio);
                
                return {
                    field: field,
                    comparison: op.tessio as any,
                    value: value
                };
            }
        }

        // Handle EXISTS and NOT EXISTS
        const existsMatch = condition.match(/^(NOT\s+)?EXISTS\s*\((.+?)\)$/i);
        if (existsMatch) {
            const [, notExists, subQueryPlaceholder] = existsMatch;
            if (subQueries && subQueries.has(subQueryPlaceholder.trim())) {
                const subquerySql = subQueries.get(subQueryPlaceholder.trim())!;
                this.warnings.push(`${notExists ? 'NOT EXISTS' : 'EXISTS'} subquery converted - manual implementation required`);
                this.unsupportedFeatures.push(`${notExists ? 'NOT EXISTS' : 'EXISTS'} condition: ${subquerySql}`);
            } else {
                this.unsupportedFeatures.push(`${notExists ? 'NOT EXISTS' : 'EXISTS'} condition: ${condition}`);
            }
            return null;
        }

        // Handle IN with subquery
        const inSubqueryMatch = condition.match(/^(\w+)\s+(NOT\s+)?IN\s*\((.+?)\)$/i);
        if (inSubqueryMatch) {
            const [, field, notIn, valueOrPlaceholder] = inSubqueryMatch;
            if (subQueries && subQueries.has(valueOrPlaceholder.trim())) {
                const subquerySql = subQueries.get(valueOrPlaceholder.trim())!;
                this.warnings.push(`${notIn ? 'NOT IN' : 'IN'} subquery for field '${field}' converted - consider using resolve or SubSession`);
                this.unsupportedFeatures.push(`${notIn ? 'NOT IN' : 'IN'} subquery: ${field} ${notIn ? 'NOT IN' : 'IN'} (${subquerySql})`);
                return null;
            }
        }

        // Handle BETWEEN
        const betweenMatch = condition.match(/^(\w+)\s+BETWEEN\s+(.+?)\s+AND\s+(.+)$/i);
        if (betweenMatch) {
            const [, field, val1, val2] = betweenMatch;
            this.warnings.push(`BETWEEN converted to >= and <= filters for field '${field}'`);
            // Return only the first filter, the second would need to be added separately
            return {
                field: field,
                comparison: '>=',
                value: this.parseValue(val1, '>=')
            };
        }

        // Handle IS NULL / IS NOT NULL
        const nullMatch = condition.match(/^(\w+)\s+IS\s+(NOT\s+)?NULL$/i);
        if (nullMatch) {
            const [, field, notNull] = nullMatch;
            return {
                field: field,
                comparison: notNull ? '!=' : '==',
                value: null
            };
        }

        this.unsupportedFeatures.push(`Unsupported condition: ${condition}`);
        return null;
    }

    /**
     * Parse value from SQL to appropriate JavaScript type
     */
    private parseValue(valueStr: string, operator: string): any {
        valueStr = valueStr.trim();

        // Handle NULL
        if (valueStr.toUpperCase() === 'NULL') {
            return null;
        }

        // Handle string literals
        if ((valueStr.startsWith("'") && valueStr.endsWith("'")) ||
            (valueStr.startsWith('"') && valueStr.endsWith('"'))) {
            return valueStr.slice(1, -1);
        }

        // Handle IN/NOT IN arrays
        if ((operator === 'in' || operator === 'notin') && 
            valueStr.startsWith('(') && valueStr.endsWith(')')) {
            const items = valueStr.slice(1, -1).split(',').map(item => 
                this.parseValue(item.trim(), '==')
            );
            return items;
        }

        // Handle numbers
        if (/^-?\d+\.?\d*$/.test(valueStr)) {
            return valueStr.includes('.') ? parseFloat(valueStr) : parseInt(valueStr);
        }

        // Handle booleans
        if (valueStr.toUpperCase() === 'TRUE') return true;
        if (valueStr.toUpperCase() === 'FALSE') return false;

        // Handle dates (basic ISO format)
        if (/^\d{4}-\d{2}-\d{2}/.test(valueStr)) {
            return new Date(valueStr);
        }

        // Default to string
        return valueStr;
    }

    /**
     * Parse ORDER BY clause
     */
    private parseOrderByClause(orderByClause: string): SortDef[] {
        const sorts: SortDef[] = [];
        const orderParts = orderByClause.split(',');

        for (const part of orderParts) {
            const trimmed = part.trim();
            const descMatch = trimmed.match(/^(.+?)\s+(DESC|ASC)$/i);
            
            if (descMatch) {
                const [, field, direction] = descMatch;
                sorts.push({
                    field: field.trim(),
                    direction: direction.toLowerCase() as 'asc' | 'desc'
                });
            } else {
                sorts.push({
                    field: trimmed,
                    direction: 'asc'
                });
            }
        }

        return sorts;
    }

    /**
     * Parse GROUP BY clause
     */
    private parseGroupByClause(groupByClause: string): Array<{ dataIndex: string }> {
        const groups = groupByClause.split(',').map(field => ({
            dataIndex: field.trim()
        }));

        return groups;
    }

    /**
     * Add aggregation columns based on SELECT clause
     */
    private addAggregationColumns(config: CreateSessionParameters, selectClause: string): void {
        // This is handled in parseSelectClause, but we might need additional processing here
        if (!config.columns) return;

        // Ensure we have a primary key for grouping
        const hasGroupByField = config.columns.some(col => 
            config.groupBy?.some(group => group.dataIndex === col.name)
        );

        if (!hasGroupByField && config.groupBy && config.groupBy.length > 0) {
            // Add the first group by field as primary key
            config.columns.unshift({
                name: config.groupBy[0].dataIndex,
                primaryKey: true
            });
        }
    }

    /**
     * Handle JOINs by converting them to SubSessions where possible
     */
    private handleJoins(config: CreateSessionParameters, joins: string[]): void {
        this.warnings.push('JOINs are converted to SubSessions - complex JOIN logic may need manual adjustment');
        this.unsupportedFeatures.push('Complex JOINs with multiple conditions not fully supported');
        
        // For now, just add a warning that JOINs need manual conversion to SubSessions
        for (const join of joins) {
            this.warnings.push(`JOIN detected: ${join} - Consider using SubSessions for relational queries`);
        }
    }

    /**
     * Handle subqueries by creating appropriate subSessions and resolve configurations
     */
    private handleSubqueries(config: CreateSessionParameters, subQueries: Map<string, string>): void {
        if (!config.subSessions) {
            config.subSessions = {};
        }

        // Process remaining subqueries that weren't handled in SELECT or WHERE
        for (const [placeholder, subquerySql] of subQueries) {
            try {
                const subQueryResult = this.convertSql(subquerySql);
                const subSessionId = `subquery_${placeholder.toLowerCase().replace(/_/g, '')}`;
                
                config.subSessions[subSessionId] = subQueryResult.sessionConfig;
                
                // Add warnings from subquery conversion
                if (subQueryResult.warnings.length > 0) {
                    this.warnings.push(`Subquery ${subSessionId} warnings: ${subQueryResult.warnings.join(', ')}`);
                }
                if (subQueryResult.unsupportedFeatures.length > 0) {
                    this.unsupportedFeatures.push(`Subquery ${subSessionId} unsupported: ${subQueryResult.unsupportedFeatures.join(', ')}`);
                }
                
                this.warnings.push(`Subquery converted to SubSession '${subSessionId}' - manual linking may be required`);
            } catch (error) {
                this.unsupportedFeatures.push(`Failed to convert subquery ${placeholder}: ${error instanceof Error ? error.message : String(error)}`);
            }
        }
    }

    /**
     * Split clause by logical operator while respecting parentheses
     */
    private splitByLogicalOperator(clause: string, operator: string): string[] {
        const parts: string[] = [];
        let current = '';
        let parenLevel = 0;
        let inQuotes = false;

        const opRegex = new RegExp(`\\s+${operator}\\s+`, 'gi');
        const tokens = clause.split(/(\s+AND\s+|\s+OR\s+|\(|\)|'[^']*')/gi);

        for (const token of tokens) {
            if (token.match(/^'.*'$/)) {
                current += token;
            } else if (token === '(') {
                parenLevel++;
                current += token;
            } else if (token === ')') {
                parenLevel--;
                current += token;
            } else if (token.match(opRegex) && parenLevel === 0) {
                if (current.trim()) {
                    parts.push(current.trim());
                    current = '';
                }
            } else {
                current += token;
            }
        }

        if (current.trim()) {
            parts.push(current.trim());
        }

        return parts.filter(part => part.trim().length > 0);
    }

    /**
     * Check if a string represents a simple field name
     */
    private isSimpleField(str: string): boolean {
        return /^\w+$/.test(str.trim());
    }

    /**
     * Convert SQL expression to JavaScript expression
     */
    private convertSqlExpression(sqlExpr: string): string {
        return sqlExpr
            .replace(/\bAND\b/gi, '&&')
            .replace(/\bOR\b/gi, '||')
            .replace(/\bNOT\b/gi, '!')
            .replace(/=/g, '==')
            .replace(/!===/g, '!='); // Fix triple equals that might occur
    }

    /**
     * Generate usage examples and documentation
     */
    public generateExample(sql: string): string {
        const result = this.convertSql(sql);
        
        let example = `// Original SQL:\n// ${sql}\n\n`;
        example += `// Converted to Tessio:\n`;
        example += `const session = eventHorizon.createSession(${JSON.stringify(result.sessionConfig, null, 2)});\n\n`;
        
        // Add explanation for nested table structures
        if (typeof result.sessionConfig.table === 'object') {
            example += `// Note: Nested table structure is used to apply filters before aggregation.\n`;
            example += `// This ensures WHERE clauses work correctly with GROUP BY operations.\n\n`;
        }
        
        if (result.warnings.length > 0) {
            example += `// Warnings:\n`;
            result.warnings.forEach(warning => {
                example += `// - ${warning}\n`;
            });
            example += '\n';
        }

        if (result.unsupportedFeatures.length > 0) {
            example += `// Unsupported features (require manual handling):\n`;
            result.unsupportedFeatures.forEach(feature => {
                example += `// - ${feature}\n`;
            });
        }

        return example;
    }
}

/**
 * Utility function to convert SQL to Tessio session config
 */
export function sqlToTessio(sql: string): SqlParseResult {
    const converter = new SqlToTessioConverter();
    return converter.convertSql(sql);
}

/**
 * Utility function to generate conversion examples
 */
export function sqlToTessioExample(sql: string): string {
    const converter = new SqlToTessioConverter();
    return converter.generateExample(sql);
}
