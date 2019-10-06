const { inspect } = require('../../out/cljs-lib/cljs-lib');

export function inspectForm(form: string) {
    const inspected = inspect(form);
    console.log(inspected);
}
