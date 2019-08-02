import { NReplSession } from "../nrepl";
import { parseEdn } from "../../cljs-out/cljs-lib";

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

function findSymbol(nReplSession: NReplSession, params) {
    return new Promise<any>((resolve, reject) => {
        let { client, messageHandlers, sessionId } = nReplSession;

        let id = client.nextId;
        let resultRefercens = { refs: [], count: null , error: null};
        messageHandlers[id] = (msg) => {
            if (msg.occurrence) {
                let parsed = parseEdn(msg.occurrence);
                resultRefercens.refs.push(parsed);
            }
            
            if (msg.count) {
                resultRefercens.count = msg.count;
            }

            if (msg.error) {
                resultRefercens.error = msg.error;
                resolve(resultRefercens);
                return true;
            }

            if (resultRefercens.count) {
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

export {
    artifactVersion,
    cleanNS,
    findSymbol
}