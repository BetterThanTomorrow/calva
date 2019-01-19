import * as stream from "stream";
import { Buffer } from "buffer";

const bencode = (value) => {
    if(value === null || value === undefined)
        value = 0;
    if(typeof value == "boolean")
        value = value ? 1 : 0;
    if(typeof value == "number")
        return "i"+value+"e";
    if(typeof value == "string")
        return Buffer.byteLength(value, 'utf8')+":"+value;
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
    accum: number[];
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

    write(byte: number) {
        let ch = String.fromCharCode(byte)
        if(this.state.id == "ready") {
            switch(ch) {
                case 'i':
                    this.state = { id: "int", accum: "" }
                    break;
                case "d":
                    this.stack.push({ id: "dict", accum: {}, key: null });
                    break;
                case "l":
                    this.stack.push({ id: "list", accum: []});
                    break;
                case "e":
                    if(!this.stack.length)
                        throw "unexpected end";
                    this.state = this.stack.pop();
                    if(this.state.id == "dict") {
                        if(this.state.key !== null)
                            throw "Missing value in dict";
                        return this.complete(this.state.accum);
                    } else if(this.state.id == "list")
                        return this.complete(this.state.accum);
                    break;
                default:
                    if(ch >= '0' && ch <= '9')
                        this.state = { id: "string-start", accum: ch }
                    else
                        throw "Malformed input in bencode"
                }
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
                this.state = { id: "string-body", accum: [], length: +this.state.accum };
            } else
                this.state.accum += ch;
        } else if(this.state.id == "string-body") {
            this.state.accum.push(byte);
            if(this.state.accum.length >= this.state.length)
                return this.complete(Buffer.from(this.state.accum).toString("utf8"));
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
        // data is now a Uint8 array, so we need to incrementally decode strings as uint8's not chars, carefully building things up properly.

        for(let i=0; i<data.length; i++) {
            let res = this.decoder.write(data[i]);
            if(res)
                this.push(res);
        }
        cb();
    }
}