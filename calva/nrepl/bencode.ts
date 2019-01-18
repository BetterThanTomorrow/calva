import * as stream from "stream";

const bencode = (value) => {
    if(value === null || value === undefined)
        value = 0;
    if(typeof value == "boolean")
        value = value ? 1 : 0;
    if(typeof value == "number")
        return "i"+value+"e";
    if(typeof value == "string")
        return value.length+":"+value;
    if(value instanceof Array)
        return "l"+value.map(bencode).join('')+"e";
    let out = "d";
    for(let prop in value)
        out += bencode(prop)+bencode(value[prop]);
    return out+"e";
}

export class BEncoderStream extends stream.Transform {
    data = [];
    constructor() {
        super({objectMode: true})
    }
    _transform(object, encoding, cb) {
        let enc = bencode(object);
        this.push(enc)
        cb();
    }
}

type State  = StringStartState | StringBodyState | IntState | ListState | DictState | ReadyState;

interface ReadyState {
    id: "ready"
}

interface StringStartState {
    id: "string-start"
    accum: string;
}

interface StringBodyState {
    id: "string-body"
    accum: string;
    length: number;
}

interface IntState {
    id: "int";
    accum: string;
}

interface ListState {
    id: "list"
    accum: any[];
}

interface DictState {
    id: "dict"
    key: string;
    accum: {[id: string]: any};
}

class BIncrementalDecoder {
    state: State = { id: "ready" };
    stack: State[] = [];

    constructor() {
    }

    private complete(data: any) {
        if(this.stack.length) {
            this.state = this.stack.pop();
            if(this.state.id == "list") {
                this.state.accum.push(data);
                this.stack.push(this.state);
                this.state = { id: "ready" };
            } else if(this.state.id == "dict") {
                if(this.state.key !== null) {
                    this.state.accum[this.state.key] = data;
                    this.state.key = null;
                } else {
                    this.state.key = data;
                }
                this.stack.push(this.state);
                this.state = { id: "ready" };
            }
        } else {
            this.state = { id: "ready" };
            return data;
        }
    }

    write(ch: string) {
        if(this.state.id == "ready") {
            if(ch == "i")
                this.state = { id: "int", accum: "" }
            else if(ch == "d")
                this.stack.push({ id: "dict", accum: {}, key: null });
            else if(ch == "l")
                this.stack.push({ id: "list", accum: []});
            else if(ch >= '0' && ch <= '9')
                this.state = { id: "string-start", accum: ch }
            else if(ch == "e") {
                if(!this.stack.length)
                    throw "unexpected end";
                this.state = this.stack.pop();
                if(this.state.id == "dict") {
                    if(this.state.key !== null)
                        throw "Missing value in dict";
                    return this.complete(this.state.accum);
                } else if(this.state.id == "list")
                    return this.complete(this.state.accum);
            } else
                throw "Malformed input in bencode"
        } else if(this.state.id == "int") {
            if(ch == "e")
                return this.complete(parseInt(this.state.accum));
            else
                this.state.accum += ch;
        } else if(this.state.id == "string-start") {
            if(ch == ":") {
                if(!isFinite(+this.state.accum))
                    throw new Error("Invalid string length: "+this.state.accum)
                if(+this.state.accum == 0)
                    return this.complete("");
                this.state = { id: "string-body", accum: "", length: +this.state.accum };
            } else
                this.state.accum += ch;
        } else if(this.state.id == "string-body") {
            this.state.accum += ch;
            if(this.state.accum.length >= this.state.length)
                return this.complete(this.state.accum);
        } else if(this.state.id == "list") {
            return this.complete(this.state.accum);
        } else if(this.state.id == "dict") {
            return this.complete(this.state.accum);
        } else
            throw "Junk in bencode"
    };
}

export class BDecoderStream extends stream.Transform {
    decoder = new BIncrementalDecoder();
    constructor() {
        super({objectMode: true});
    }

    _transform(data, encoding, cb) {
        let input = data.toString();
        for(let i=0; i<input.length; i++) {
            let res = this.decoder.write(input[i]);
            if(res)
                this.push(res);
        }
        cb();
    }
}