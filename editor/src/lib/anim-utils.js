/*******************************************************
 * Helper: Calculate control points for a single keyframe
 *******************************************************/
function calculateKeyframeControlPoints(prev, current, next) {
  let inControlPoint = null;
  let outControlPoint = null;

  // In control point (for current keyframe)
  if (prev) {
    const dt = current.time - prev.time;
    const { speed, influence } = current.easing.inEase;
    if (current.easing.inType === "LINEAR") {
      // For linear, the in control point is effectively the same as current
      const P1x = current.time;
      const P1y = current.value;
      inControlPoint = { x: P1x, y: P1y };
    } else {
      // After Effects Bezier math for incoming handle
      // The handle extends backward in time by (influence/100) * dt
      const P1x = current.time - (influence / 100) * dt;
      // The handle's Y value is based on the speed (units per second) at the keyframe
      const P1y = current.value - speed * (influence / 100) * dt;
      inControlPoint = { x: P1x, y: P1y };
    }
  }

  // Out control point (for current keyframe)
  if (next) {
    const dt = next.time - current.time;
    const { speed, influence } = current.easing.outEase;
    if (current.easing.outType === "LINEAR") {
      // For linear, the out control point is effectively the same as current
      const P2x = current.time;
      const P2y = current.value;
      outControlPoint = { x: P2x, y: P2y };
    } else if (current.easing.outType === "HOLD") {
      // "HOLD" means no interpolation from this keyframe onward,
      // but we can set outControlPoint = current itself
      const P2x = current.time;
      const P2y = current.value;
      outControlPoint = { x: P2x, y: P2y };
    } else {
      // After Effects Bezier math for outgoing handle
      // The handle extends forward in time by (influence/100) * dt
      const P2x = current.time + (influence / 100) * dt;
      // The handle's Y value is based on the speed (units per second) at the keyframe
      const P2y = current.value + speed * (influence / 100) * dt;
      outControlPoint = { x: P2x, y: P2y };
    }
  }

  return { inControlPoint, outControlPoint };
}

/*******************************************************
 * Helper: Cubic Bezier function
 *******************************************************/
function cubicBezier(t, p0, p1, p2, p3) {
  // Standard cubic Bezier polynomial:
  // B(t) = (1 - t)^3 * p0 + 3(1 - t)^2 * t * p1
  //      + 3(1 - t) * t^2 * p2 + t^3 * p3
  const mt = 1 - t;
  return (
    mt * mt * mt * p0 +
    3 * mt * mt * t * p1 +
    3 * mt * t * t * p2 +
    t * t * t * p3
  );
}

/*******************************************************
 * Helper: Solve for t in x(t) = targetX using binary search
 *******************************************************/
function solveForTime(targetX, p0, p1, p2, p3, iterations = 10) {
  let lower = 0;
  let upper = 1;
  let t;

  for (let i = 0; i < iterations; i++) {
    t = (lower + upper) / 2;
    const xAtT = cubicBezier(t, p0, p1, p2, p3);

    if (xAtT < targetX) {
      lower = t;
    } else {
      upper = t;
    }
  }
  return (lower + upper) / 2;
}

/*******************************************************
 * Helper: Interpolate path data (vertices, tangents)
 *******************************************************/
function interpolatePathData(pathData1, pathData2, t) {
  // Interpolate between two path data objects
  const result = {
    closed: pathData1.closed, // Keep closed property from first path
    featherInterps: pathData1.featherInterps || [],
    featherRadii: pathData1.featherRadii || [],
    featherRelCornerAngles: pathData1.featherRelCornerAngles || [],
    featherRelSegLocs: pathData1.featherRelSegLocs || [],
    featherSegLocs: pathData1.featherSegLocs || [],
    featherTensions: pathData1.featherTensions || [],
    featherTypes: pathData1.featherTypes || [],
    vertices: [],
    inTangents: [],
    outTangents: []
  };

  // Interpolate vertices
  const maxVertices = Math.max(pathData1.vertices.length, pathData2.vertices.length);
  for (let i = 0; i < maxVertices; i++) {
    const v1 = pathData1.vertices[i] || [0, 0];
    const v2 = pathData2.vertices[i] || [0, 0];
    result.vertices.push([
      v1[0] + t * (v2[0] - v1[0]),
      v1[1] + t * (v2[1] - v1[1])
    ]);
  }

  // Interpolate inTangents
  for (let i = 0; i < maxVertices; i++) {
    const t1 = pathData1.inTangents[i] || [0, 0];
    const t2 = pathData2.inTangents[i] || [0, 0];
    result.inTangents.push([
      t1[0] + t * (t2[0] - t1[0]),
      t1[1] + t * (t2[1] - t1[1])
    ]);
  }

  // Interpolate outTangents
  for (let i = 0; i < maxVertices; i++) {
    const t1 = pathData1.outTangents[i] || [0, 0];
    const t2 = pathData2.outTangents[i] || [0, 0];
    result.outTangents.push([
      t1[0] + t * (t2[0] - t1[0]),
      t1[1] + t * (t2[1] - t1[1])
    ]);
  }

  return result;
}

/*******************************************************
 * Main function: getValueAtTime
 *******************************************************/
export function getValueAtTime(trackJson, time) {
  const keyframes = trackJson.keyframes;

  // 1) If time is before the first keyframe, return the first value:
  if (time <= keyframes[0].time) {
    return keyframes[0].value;
  }
  // 2) If time is after the last keyframe, return the last value:
  if (time >= keyframes[keyframes.length - 1].time) {
    return keyframes[keyframes.length - 1].value;
  }

  // 3) Otherwise, find the two keyframes between which `time` lies
  let startIndex = 0;
  for (let i = 0; i < keyframes.length - 1; i++) {
    if (time >= keyframes[i].time && time < keyframes[i + 1].time) {
      startIndex = i;
      break;
    }
  }

  const kf0 = keyframes[startIndex];
  const kf1 = keyframes[startIndex + 1];

  // If the next keyframe starts exactly where we are, return next keyframe's value
  if (time === kf1.time) {
    return kf1.value;
  }

  // 4) Determine interpolation method based on both keyframe types
  const outType = kf0.easing.outType;
  const inType = kf1.easing.inType;

  // If either keyframe is HOLD, use the first keyframe's value
  if (outType === "HOLD" || inType === "HOLD") {
    return kf0.value;
  }
  
  // If both keyframes are LINEAR, use linear interpolation
  if (outType === "LINEAR" && inType === "LINEAR") {
    const tLinear = (time - kf0.time) / (kf1.time - kf0.time);
    
    // Check if we're dealing with path data (complex object)
    if (typeof kf0.value === 'object' && kf0.value !== null && kf0.value.vertices) {
      return interpolatePathData(kf0.value, kf1.value, tLinear);
    }
    
    return kf0.value + tLinear * (kf1.value - kf0.value);
  }

  // For any bezier interpolation, use After Effects' actual algorithm
  const dt = kf1.time - kf0.time;
  const t = (time - kf0.time) / dt; // normalized time [0,1]

  // Calculate control points using After Effects' method
  let outHandle = { x: kf0.time, y: kf0.value };
  let inHandle = { x: kf1.time, y: kf1.value };

  // Outgoing handle from kf0
  if (outType === "BEZIER") {
    const { speed, influence } = kf0.easing.outEase;
    const handleTime = kf0.time + (influence / 100) * dt;
    const handleValue = kf0.value + speed * (influence / 100) * dt;
    outHandle = { x: handleTime, y: handleValue };
  }

  // Incoming handle to kf1
  if (inType === "BEZIER") {
    const { speed, influence } = kf1.easing.inEase;
    const handleTime = kf1.time - (influence / 100) * dt;
    const handleValue = kf1.value - speed * (influence / 100) * dt;
    inHandle = { x: handleTime, y: handleValue };
  }

  // Now we have our four control points for the cubic bezier
  const P0 = { x: kf0.time, y: kf0.value };
  const P1 = outHandle;
  const P2 = inHandle;
  const P3 = { x: kf1.time, y: kf1.value };

  // For mixed interpolation (LINEAR + BEZIER), After Effects uses a special approach
  if ((outType === "LINEAR" && inType === "BEZIER") || (outType === "BEZIER" && inType === "LINEAR")) {
    // Use a simplified cubic bezier with the linear side having minimal influence
    if (outType === "LINEAR") {
      // Linear out, bezier in - adjust P1 to be closer to P0
      P1.x = kf0.time + 0.01 * dt; // Very small influence
      P1.y = kf0.value;
    }
    if (inType === "LINEAR") {
      // Bezier out, linear in - adjust P2 to be closer to P3
      P2.x = kf1.time - 0.01 * dt; // Very small influence
      P2.y = kf1.value;
    }
  }

  // Solve for t parameter where x(t) = time
  const bezierT = solveForTime(time, P0.x, P1.x, P2.x, P3.x, 15);
  
  // Check if we're dealing with path data (complex object)
  if (typeof kf0.value === 'object' && kf0.value !== null && kf0.value.vertices) {
    return interpolatePathData(kf0.value, kf1.value, bezierT);
  }
  
  // Evaluate y(t) at that parameter
  const result = cubicBezier(bezierT, P0.y, P1.y, P2.y, P3.y);
  return result;
}
