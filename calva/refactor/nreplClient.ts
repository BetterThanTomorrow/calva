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

export {
    artifactVersion,
    cleanNS
}