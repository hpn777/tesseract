const _ = require('lodash')
const flat = require('flat')
const {
  map,
  bufferTime,
  take,
  tap
} = require('rxjs/operators')

/**
 *  partial, ordered comparison of messages
 */
const assertArraysMatch = (messages, results, failCallback = () => {}, passCallback = () => {}) => {
    const errors = _(messages)
        .zip(results)
        .reduce((accErrors, [actual, asserted], index) => {
                
            if(_.isMatch(actual, asserted)) {
                return accErrors
            }

            const properties = _(asserted)
                .reduce((acc, value, key) => {
                    if(_.isUndefined(actual)) {
                        acc.push({key, left: 'parent.undefined', right: value})
                        return acc
                    }
                    if(actual[key] === value) {
                        return acc
                    }
                    acc.push({key, left: actual[key], right: value})
                    return acc
                }, [])

            const error = {
                index,
                actual,
                properties
            }

            accErrors.push(error)
            return accErrors

        }, [])

    if(_.isEmpty(errors) && messages.length == results.length) {
        passCallback()
        return
    }

    const errorHeader = `Messages don't match`
	
    var message = _(errors)
        .flatMap(({actual, index, properties}) => {
            return properties
                .map(({key, left, right}) => {
                    return `Index: ${index} Key: '${key}' ${left} != ${right}` 
                })
        })
        .value()
        .join('\n')

    if(messages.length > results.length) {
        message += `\nExpected ${results.length}, got more messages\n`
        message += `------GOT THIS------`
        message += JSON.stringify(messages, null, 2) + '\n'
        message += `------EXPECTED------`
        message += JSON.stringify(results, null, 2) + '\n'
    }

    let fullError = errorHeader + '\n' + message
    failCallback(fullError)
    return fullError
}

// assert stream's buffer matches result
const tapeAssert = (t, messages$, result, message = 'Messages match', time = 100) => {

    return messages$.pipe(
        map(u => flat(u.toJSON())), 
        bufferTime(time, null, result.length + 1),
        take(1),
        tap(
            r => {
                assertArraysMatch(r, result, e => t.fail(e), () => t.pass(message))
            }
        )
    )
}

module.exports = {
  assertArraysMatch,
  tapeAssert
}
