class Filters {

    constructor() {
        this.items = []
        this.length = 0
    }

    reset(items) {
        this.items = items
        this.length = items.length
    }

	applyFilters(row) {
        return this.items.reduce((valid, filter) => {
            return valid && filter.applyFilter(row)
        }, true)
    }
}

module.exports = Filters