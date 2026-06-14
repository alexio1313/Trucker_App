// Fix journey-routes.js deliver endpoint SQL type ambiguity
// Run on SERVER: node /tmp/patch_journey_deliver.js
var fs = require('fs');

var src = fs.readFileSync('/tmp/trucker_journey_routes.js', 'utf8');

// Fix the deliver SQL — explicit cast for $2 everywhere to avoid type ambiguity
var oldSql = "'UPDATE journey_logs SET journey_status=$1,end_odometer_km=$2,actual_toll_cost=$3,' +" +
             "\n          'total_distance_km=CASE WHEN start_odometer_km IS NOT NULL AND $2 IS NOT NULL THEN ($2::numeric-start_odometer_km) ELSE NULL END,' +";

var newSql = "'UPDATE journey_logs SET journey_status=$1,end_odometer_km=$2::numeric,actual_toll_cost=$3::numeric,' +" +
             "\n          'total_distance_km=CASE WHEN start_odometer_km IS NOT NULL THEN ($2::numeric-start_odometer_km) ELSE NULL END,' +";

if (src.indexOf(oldSql) !== -1) {
  src = src.replace(oldSql, newSql);
  console.log('Fixed deliver SQL type cast');
} else {
  // Try a simpler search
  var idx = src.indexOf('total_distance_km=CASE WHEN start_odometer_km IS NOT NULL AND $2 IS NOT NULL');
  if (idx >= 0) {
    src = src.replace(
      'total_distance_km=CASE WHEN start_odometer_km IS NOT NULL AND $2 IS NOT NULL THEN ($2::numeric-start_odometer_km) ELSE NULL END',
      'total_distance_km=CASE WHEN start_odometer_km IS NOT NULL THEN ($2::numeric-start_odometer_km) ELSE NULL END'
    );
    src = src.replace(
      'end_odometer_km=$2,actual_toll_cost=$3',
      'end_odometer_km=$2::numeric,actual_toll_cost=$3::numeric'
    );
    console.log('Fixed via direct string replacement');
  } else {
    console.log('Could not find target SQL -- searching...');
    var i = src.indexOf('end_odometer_km=$2');
    console.log('end_odometer_km=$2 at index:', i);
    console.log('Context:', src.slice(Math.max(0,i-20), i+200));
    process.exit(1);
  }
}

fs.writeFileSync('/tmp/trucker_journey_routes_patched.js', src);
console.log('Done. Patched size:', src.length);
