var EVH = new (require('../lib/eventHorizon'))({
    // commandPort: {
    //     host: 'exec', 
    //     port: 6789
    // }
})

EVH.createSession({
    id:'liveQuery',
    table: 'users',
    subSessions: {
        acl: {
            table: 'users_acl',
            columns:  [{
                name: 'rowId',
                primaryKey: true,
            }, {
                name: 'userId'
            }],
            filter: [{
                field: 'userId',
                comparison: 'eq',
                value: 12345,
            }]
        }
    },
    columns: [{
        name: 'id',
        primaryKey: true,
    }, {
        name: 'name',
    }, {
        name: 'expTest',
    }, {
        name: 'msgCount',
        resolve: {
            underlyingField: 'id',
            session: 'a',
            displayField: 'count'
        }
    }, {
        name: 'msgMin',
        resolve: {
            underlyingField: 'id',
            session: 'a',
            displayField: 'min'
        }
    },{
        name: 'halfCount',
        expression: 'msgCount/3'
    },{
        name: 'fullName',
        value: '${name}-${id}'
    },{
        name: 'acl',
        resolve: {
            underlyingField: 'id',
            session: 'acl',
            displayField: 'rowId'
        }
    }],
    permanentFilters: [{
        field: 'acl',
        comparison: 'neq',
        value: undefined,
    }],
    // filter: [{
    //     field: 'msgCount',
    //     comparison: 'eq',
    //     value: 1,
    // }],
    sort: [  { field: 'name', direction: 'asc' }]
})