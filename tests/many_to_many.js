var {mergeColumns, guid} = require('../lib/utils')
var Tesseract = require('../lib/tesseract')
var EVH = new (require('../lib/eventHorizon'))({
    namespace: 'test_namespace'
    // commandPort: {
    //     host: 'exec', 
    //     port: 6789
    // }
})
var _ = require('lodash')



var role = EVH.createTesseract('role', {
    columns: [
        {name: 'id', primaryKey: true},
        {name: 'roleName'}
    ]
})

var module_roles = EVH.createTesseract('module_roles', {
    columns: [
        {name: 'id', primaryKey: true},
        {name: 'module_id'}, 
        {name: 'roles_id'}
    ]
})

var user_roles = EVH.createTesseract('user_roles', {
    columns: [
        {name: 'id', primaryKey: true},
        {name: 'user_id'}, 
        {name: 'roles_id'}
    ]
})

var module = EVH.createTesseract('module', {
    columns: [{name: 'id', primaryKey: true},
        {name: 'name'},
        {name: 'moduleClassName'},
        {name: 'moduleType'},
        {name: 'moduleGroup'},
        {name: 'config'},
        {name: 'parentId'},
        {name: 'owner_id'},
        {name: 'description'}
    ]
})




role.add([{id: 1, roleName: "admin"}, {id: 2, roleName: "guest"}, {id: 3, roleName: "test_role"}])
module.add([{id: 1, name: 'module1'},{id: 2, name: 'module2'},{id: 3, name: 'module3'},{id: 4, name: 'module4'},{id: 5, name: 'module5'},{id: 6, name: 'module6'},])
user_roles.add([{id: 1, user_id: 1, roles_id: 1},{id: 1, user_id: 1, roles_id: 2},{id: 2, user_id: 2, roles_id: 2},{id: 3, user_id: 3, roles_id: 3}])
module_roles.add([{id: 1, module_id: 1, roles_id: 1},{id: 2, module_id: 2, roles_id: 2},{id: 3, module_id: 3, roles_id: 3}])

var user_roles_session = EVH.createSession({
    table: 'user_roles',
    columns: [{
        name: 'roles_id', primaryKey: true
    },{
        name: 'user_id'
    }],
    filter:[{
        field: 'user_id',
        value: 1,
        comparison: 'eq'
    }]
})

var module_roles_session = EVH.createSession({
    table: 'module_roles',
    subSessions: {
        user_roles: {
            table: 'user_roles',
            columns: [{
                name: 'roles_id', primaryKey: true
            },{
                name: 'user_id'
            }],
            filter:[{
                field: 'user_id',
                value: 1,
                comparison: 'eq'
            }]
        }
    },
    columns: [{
        name: 'module_id', primaryKey: true
    },{
        name: 'roles_id',
    },{
        name: 'user_role',
        resolve: {
            underlyingField: 'roles_id',
            session: 'user_roles',
            displayField: 'roles_id',
        },
    }]
})

var session = EVH.createSession({
    table: 'module',
    subSessions: {
        module_roles: {
            table: 'module_roles',
            subSessions: {
                user_roles: {
                    table: 'user_roles',
                    columns: [{
                        name: 'roles_id', primaryKey: true
                    },{
                        name: 'user_id'
                    }],
                    filter:[{
                        field: 'user_id',
                        value: 1,
                        comparison: 'eq'
                    }]
                }
            },
            columns: [{
                name: 'module_id', primaryKey: true
            },{
                name: 'roles_id',
            },{
                name: 'user_role',
                resolve: {
                    underlyingField: 'roles_id',
                    session: 'user_roles',
                    displayField: 'roles_id',
                },
            }],
            filter: [{
                field: 'user_role',
                value: undefined,
                comparison: 'neq'
            }]
        }
    },
    columns: [
        {name: 'id', primaryKey: true},
        {name: 'name'},
        {
            name: 'user_role',
            resolve: {
                underlyingField: 'id',
                session: 'module_roles',
                displayField: 'user_role',
            }
        }
    ],
    filter: [{
        field: 'user_role',
        value: undefined,
        comparison: 'neq'
    }]
}, true)


user_roles_session.on('dataUpdate',  x => {
    console.log('user_roles_session update', x.toJSON())
    console.log('user_roles_session state',user_roles_session.getLinq().select(x=>x.object).toArray())
    
})
module_roles_session.on('dataUpdate',  x => {
    console.log('module_roles_session update', x.toJSON())
    console.log('module_roles_session state',module_roles_session.getLinq().select(x=>x.object).toArray())
    
})

console.log(session.getLinq(x=>x.object).toArray())
session.on('dataUpdate',  x => {
    console.log('update', x.toJSON())
})
setTimeout(() => {module_roles.add([{id: 4, module_id: 2, roles_id: 1}])}, 500)

setTimeout(() => {user_roles.add([{id: 4, user_id: 1, roles_id: 3}])}, 1000)

setTimeout(() => {user_roles.remove([1])}, 1500)
setTimeout(() => {console.log(session.getLinq().select(x=>x.object).toArray())}, 2000)

console.log(EVH.tesseracts.map(x=>x.get('id')))


// module_roles.remove([1, 2])
