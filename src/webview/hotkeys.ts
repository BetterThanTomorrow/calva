export const ALT     = 1;
export const CTRL    = 2;
export const SHIFT   = 4;
export const META    = 8;

const isMac = navigator.platform.match(/Mac(Intel|PPC|68k)/i); // somewhat optimistic this would run on MacOS8 but hey ;)

let keyToId: {[id: string]: number} = {}
let idToKey: {[id: string]: string} = {}

interface CommandWidget {
    commands: {[id: string]: () => void};
}

function key(name: string, id: number) {
    keyToId[name.toLowerCase()] = id;
    idToKey[id] = name;
}

key("Backspace", 8)
key("Space", 0x20)
key("Tab", 9)
key("Return", 13)
key("End", 35)
key("/", 191)
key("[", 219)

key("Home", 36)
key("LeftArrow", 37)
key("UpArrow", 38)
key("RightArrow", 39)
key("DownArrow", 40)
key("Delete", 46)

export function parseHotKey(key: string, command: any) {
    let parts = key.split("+").map(x => x.trim().toLowerCase());
    let i=0;
    let modifiers = 0;
    outer: for(; i<parts.length; i++) {
        switch(parts[i]) {
            case "alt": modifiers |= ALT; break;
            case "ctrl": modifiers |= CTRL; break;
            case "shift": modifiers |= SHIFT; break;
            case "meta": modifiers |= META; break;
            case "cmd": modifiers |= (isMac ? META : CTRL); break;
            default:
                break outer;
        }
    }
    if(i == parts.length)
        throw new Error("No key after modifiers");
    if(i != parts.length-1)
        throw new Error("Too many keys after modifiers");
    let mainKey = parts[parts.length-1];
    if(mainKey.length == 1) {
        let key = keyToId[mainKey];
        if(key === undefined)
            return new HotKey(modifiers, mainKey.toUpperCase().charCodeAt(0), command);
        return new HotKey(modifiers, key, command)
    } else {
        let key = keyToId[mainKey];
        if(key === undefined)
            throw new Error("Unknown key: "+mainKey);
        return new HotKey(modifiers, key, command)
    }
}

export class HotKey {
    constructor(public modifiers: number, public key: number, public command: string) {
    }

    match(e: KeyboardEvent): boolean {
        let mods = 0;
        if(e.altKey) mods |= ALT;
        if(e.shiftKey) mods |= SHIFT;
        if(e.ctrlKey) mods |= CTRL;
        if(e.metaKey) mods |= META;

        return this.modifiers == mods && this.key == e.keyCode;
    }
}

export class HotKeyTable<T extends CommandWidget> {
    table: HotKey[] = [];
    constructor(keys: {[id: string]: keyof T["commands"]}) {
        for(let key in keys)
            this.table.push(parseHotKey(key, keys[key]));
    }

    execute(obj: T, e: KeyboardEvent) {
        for(let key of this.table) {
            if(key.match(e)) {
                obj.commands[key.command]()
                return true;
            }
        }
        return false;
    }
}