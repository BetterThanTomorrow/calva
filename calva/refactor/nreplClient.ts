import { parseEdn } from "../../cljs-out/cljs-lib";
import { NReplSession } from "../nrepl";

function artifactVersion (nReplSession:NReplSession, artifact: string) {
    return new Promise<any>((resolve, reject) => {
        let { client, messageHandlers, sessionId } = nReplSession;

        let id = client.nextId;
        console.log("Artiifact-list before message");
        messageHandlers[id] = (msg) => {
            resolve(msg);
            return true;
        }

        client.write({
            op: "artifact-versions",
            artifact,
            id,
            session: sessionId
        });
    })
}

function cleanNS(nReplSession: NReplSession, path: string) {
    return new Promise<any>((resolve, reject) => {
        let { client, messageHandlers, sessionId } = nReplSession;

        let id = client.nextId;
        messageHandlers[id] = (msg) => {
            resolve(msg);
            return true;
        }
        client.write({ op: "clean-ns", path, id, session: sessionId })
    })
}

function warmAstCache(nReplSession: NReplSession) {
    return new Promise<any>((resolve, reject) => {
        let { client, messageHandlers, sessionId } = nReplSession;

        let id = client.nextId;
        messageHandlers[id] = (msg) => {
            resolve(msg);
            console.log(msg);
            return true;
        }
        client.write({ op: "warm-ast-cache", id, session: sessionId })
    }) 
}

function findSymbol(nReplSession: NReplSession, params) {
    return new Promise<any>((resolve, reject) => {
        let { client, messageHandlers, sessionId } = nReplSession;

        let id = client.nextId;
        let resultRefercens = { refs: [], count: null , error: null};
        messageHandlers[id] = (msg) => {
            console.log(msg);

            if (msg.occurrence) {
                let parsed = parseEdn(msg.occurrence);
                resultRefercens.refs.push(parsed);
            }
            
            resultRefercens.count = msg.count;

            if (msg.error || msg.ex) {
                resultRefercens.error = msg.error || msg.ex;
                resolve(resultRefercens);
                return true;
            }

            if (resultRefercens.count || resultRefercens.count == 0) {
                console.log("found all references", resultRefercens);
                resolve(resultRefercens);
                return true;
            } else {
                return false;
            }
            
        }

        Object.assign(params, { op: "find-symbol", id, session: sessionId});

        client.write(params)
    })
}

export { artifactVersion, warmAstCache, cleanNS, findSymbol };
