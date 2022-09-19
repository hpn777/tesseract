var EVH = new (require('../lib/eventHorizon'))({
    commandPort: {
        host: 'exec', 
        port: 6789
    }
})

var messages = EVH.createTesseract('messageQueue', {
    columns: [{
        name: 'id',
        primaryKey: true,
    }, {
        name: 'message',
    }, {
        name: 'status',
        aggregator: 'avg',
        // secondaryKey: true
    }, {
        name: 'user',
        // secondaryKey: true
    }, {
        name: 'deleted',
        // secondaryKey: true
    }, {
        name: 'update',
        value: data => new Date(),
        aggregator: 'max'
    }]
})

var users = EVH.createTesseract('users', {
    columns: [{
        name: 'id',
        primaryKey: true,
    }, {
        name: 'parentId',
    }, {
        name: 'expTest',
        expression: 'id/2'
    }, {
        name: 'name',
    }]
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
    permanentFilter: [{
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

users.add({
    id: 1,
    parentId: 1,
    name: 'rafal'
})
users.add({
    id: 2,
    parentId: 1,
    name: 'daniel'
})
users.add({
    id: 3,
    parentId: 1,
    name: 'lauren'
})


messages.add({
    id: ii++,
    message: 'dupa',
    user: 3,
    status: 1,
    deleted: false
})
messages.add({
    id: ii++,
    message: 'cipa',
    user: 1,
    status: 1,
    deleted: false
})
messages.add({
    id: ii++,
    message: 'bla',
    user: 3,
    status: 2,
    deleted: false
})
messages.add({
    id: ii++,
    message: 'bla2',
    user: 2,
    status: 2,
    deleted: false
})
messages.add({
    id: ii++,
    message: 'bla3',
    user: 2,
    status: 2,
    deleted: false
})

messages.update({
    id: 2,
    message: 'cipa2',
    status: 3
})