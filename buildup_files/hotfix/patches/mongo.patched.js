"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDb = getDb;
exports.getCollection = getCollection;
exports.disconnectMongo = disconnectMongo;
const mongodb_1 = require("mongodb");
const env_1 = require("../config/env");
const logger_1 = require("../logger");
let client = null;
let db = null;
// Parse a MongoDB URI where the password may contain '@' characters.
// Standard URL parsers split on the first '@' but the last '@' is the host separator.
function parseMongoUri(uri) {
    const withoutScheme = uri.replace(/^mongodb:\/\//, '');
    const lastAt = withoutScheme.lastIndexOf('@');
    const userPass = withoutScheme.substring(0, lastAt);
    const hostAndRest = withoutScheme.substring(lastAt + 1);
    const colonIdx = userPass.indexOf(':');
    const username = userPass.substring(0, colonIdx);
    const password = userPass.substring(colonIdx + 1);
    const slashIdx = hostAndRest.indexOf('/');
    const hostPort = hostAndRest.substring(0, slashIdx);
    const afterSlash = hostAndRest.substring(slashIdx + 1);
    const qIdx = afterSlash.indexOf('?');
    const dbName = qIdx >= 0 ? afterSlash.substring(0, qIdx) : afterSlash;
    const queryString = qIdx >= 0 ? afterSlash.substring(qIdx + 1) : '';
    const authSourceMatch = queryString.match(/authSource=([^&]+)/);
    const authSource = authSourceMatch ? authSourceMatch[1] : 'admin';
    return { username, password, hostPort, dbName, authSource };
}
async function getDb() {
    if (db)
        return db;
    const { username, password, hostPort, dbName, authSource } = parseMongoUri(env_1.env.MONGODB_URI);
    client = new mongodb_1.MongoClient(`mongodb://${hostPort}`, {
        auth: { username, password },
        authSource,
    });
    await client.connect();
    db = client.db(dbName);
    logger_1.logger.info('MongoDB connected (social-publishing)');
    return db;
}
async function getCollection(name) {
    const database = await getDb();
    return database.collection(name);
}
async function disconnectMongo() {
    if (client) {
        await client.close();
        client = null;
        db = null;
    }
}
//# sourceMappingURL=mongo.js.map
