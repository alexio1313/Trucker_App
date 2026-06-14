// =============================================================
// AI TRUCK LOGISTICS PLATFORM - MongoDB Initialization
// Collections for flexible/document data
// =============================================================

const db = db.getSiblingDB('truck_platform');

// =============================================================
// COLLECTION 1: chat_messages
// =============================================================
db.createCollection('chat_messages', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['load_id', 'sender_id', 'sender_type', 'message', 'timestamp'],
      properties: {
        load_id:      { bsonType: 'string' },
        sender_id:    { bsonType: 'string' },
        sender_type:  { enum: ['merchant', 'trucker', 'system', 'admin'] },
        message:      { bsonType: 'string', maxLength: 5000 },
        message_type: { enum: ['text', 'image', 'document', 'system'] },
        media_url:    { bsonType: 'string' },
        timestamp:    { bsonType: 'date' },
        read_by:      { bsonType: 'array' },
        ai_moderated: { bsonType: 'bool' },
        sentiment:    { enum: ['positive', 'neutral', 'negative', null] },
        flagged:      { bsonType: 'bool' },
        deleted_at:   { bsonType: ['date', 'null'] }
      }
    }
  }
});

db.chat_messages.createIndex({ load_id: 1, timestamp: -1 });
db.chat_messages.createIndex({ sender_id: 1, timestamp: -1 });
db.chat_messages.createIndex({ timestamp: 1 }, { expireAfterSeconds: 7776000 }); // 90 day TTL

// =============================================================
// COLLECTION 2: load_metadata
// Extended load info (too flexible for PostgreSQL)
// =============================================================
db.createCollection('load_metadata');

db.load_metadata.createIndex({ load_id: 1 }, { unique: true });
db.load_metadata.createIndex({ 'ai_analysis.updated_at': -1 });

// Sample structure:
// {
//   load_id: 'LD_2026_001234',
//   ai_analysis: {
//     route_score: 0.92,
//     demand_score: 0.85,
//     risk_factors: ['weather_risk_low', 'high_demand_corridor'],
//     similar_loads: [...],
//     updated_at: ISODate()
//   },
//   blockade_history: [ { location, severity, detected_at, cleared_at } ],
//   route_alternatives: [ { route_id, distance_km, toll_cost, time_estimate, score } ],
//   realtime_updates: [ { type, message, timestamp } ]
// }

// =============================================================
// COLLECTION 3: user_profiles_extended
// Extended profile data (flexible attributes per user type)
// =============================================================
db.createCollection('user_profiles_extended');

db.user_profiles_extended.createIndex({ user_id: 1 }, { unique: true });
db.user_profiles_extended.createIndex({ 'preferences.updated_at': -1 });

// =============================================================
// COLLECTION 4: route_cache
// Cached route data from external APIs
// =============================================================
db.createCollection('route_cache', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['route_hash', 'created_at'],
      properties: {
        route_hash:   { bsonType: 'string' },
        origin:       { bsonType: 'object' },
        destination:  { bsonType: 'object' },
        routes:       { bsonType: 'array' },
        toll_data:    { bsonType: 'array' },
        created_at:   { bsonType: 'date' }
      }
    }
  }
});

db.route_cache.createIndex({ route_hash: 1 }, { unique: true });
db.route_cache.createIndex({ created_at: 1 }, { expireAfterSeconds: 3600 }); // 1 hour TTL

// =============================================================
// COLLECTION 5: analytics_events
// User behavior tracking for ML training
// =============================================================
db.createCollection('analytics_events');

db.analytics_events.createIndex({ user_id: 1, timestamp: -1 });
db.analytics_events.createIndex({ event_type: 1, timestamp: -1 });
db.analytics_events.createIndex({ timestamp: 1 }, { expireAfterSeconds: 15552000 }); // 180 day TTL

// =============================================================
// COLLECTION 6: social_analytics
// Social media post performance data
// =============================================================
db.createCollection('social_analytics');

db.social_analytics.createIndex({ post_id: 1 }, { unique: true });
db.social_analytics.createIndex({ created_at: -1 });

// =============================================================
// COLLECTION 7: ml_predictions
// Store ML model outputs for analysis and retraining
// =============================================================
db.createCollection('ml_predictions');

db.ml_predictions.createIndex({ load_id: 1 });
db.ml_predictions.createIndex({ model_name: 1, created_at: -1 });
db.ml_predictions.createIndex({ created_at: 1 }, { expireAfterSeconds: 7776000 }); // 90 days

// =============================================================
// COLLECTION 8: blockade_reports
// User-submitted and API-detected blockade data
// =============================================================
db.createCollection('blockade_reports');

db.blockade_reports.createIndex({ 'location.lat': 1, 'location.lng': 1 });
db.blockade_reports.createIndex({ status: 1, severity: 1 });
db.blockade_reports.createIndex({ reported_at: -1 });
db.blockade_reports.createIndex({ reported_at: 1 }, { expireAfterSeconds: 86400 }); // 24 hour TTL

print('✅ MongoDB collections created successfully');
print('Collections: chat_messages, load_metadata, user_profiles_extended,');
print('             route_cache, analytics_events, social_analytics,');
print('             ml_predictions, blockade_reports');
