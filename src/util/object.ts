/** A cheesy deep-equal function for matching scanner states. Good enough to compare plain old js objects. */
function deepEqual(x: any, y: any): boolean {
    if (x == y) {
        return true;
    }
    if (x instanceof Array && y instanceof Array) {
        if (x.length == y.length) {
            for (let i = 0; i < x.length; i++) {
                if (!deepEqual(x[i], y[i])) {
                    return false;
                }
            }
            return true;
        } else {
            return false;
        }
    } else if (
        !(x instanceof Array) &&
        !(y instanceof Array) &&
        x instanceof Object &&
        y instanceof Object
    ) {
        for (let f in x) {
            if (!deepEqual(x[f], y[f])) {
                return false;
            }
        }
        for (let f in y) {
            if (!x.hasOwnProperty(f)) {
                return false;
            }
        }
        return true;
    }
    return false;
}

export { deepEqual };
