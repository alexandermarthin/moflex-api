# Precomposition Implementation Plan

## Overview

This document outlines the strategy for implementing precomposition (nested composition) support in the video editor. Precompositions allow compositions to be used as layers within other compositions, enabling modular, reusable animation building blocks.

## Current Architecture Analysis

### Existing Structure
- **Compositions** already exist as assets with `type: "composition"`
- **Clips** reference assets via `sourceId`
- **Layer types** include: solid, image, video, text, shape, audio
- **Rendering** uses Three.js with FBO-based compositing
- **Compositor2D** handles layer blending, effects, and 3D/2D mixing

### What Works in Our Favor
✅ Composition metadata already complete (width, height, duration, frameRate, backgroundColor)  
✅ FBO rendering pipeline established (see `MaskedLayer.jsx`, `Compositor2D.jsx`)  
✅ Recursive portal-based rendering pattern proven  
✅ Layer isolation and compositing working  
✅ Asset-clip relationship architecture supports this  

---

## 1. Data Structure Changes

### A. New Layer Type
Add support for precomp layers in the clip structure:

```javascript
clip = {
  layerType: "precomp",
  sourceId: "composition-asset-id", // References composition asset
  // ... standard clip properties (position, scale, rotation, etc.)
  timeStretch: 1.0,     // Playback speed multiplier
  timeRemap: null,      // Optional: keyframed time remapping
  loopMode: "clamp",    // "clamp" | "loop" | "pingpong"
}
```

### B. Composition Asset Structure (Already Exists)
```javascript
asset = {
  type: "composition",
  id: "comp-id",
  name: "My Precomp",
  width: 1920,
  height: 1080,
  duration: 5.0,
  frameRate: 25,
  backgroundColor: { red: 0, green: 0, blue: 0 },
  clipIds: ["clip1", "clip2", ...] // Layers in this comp
}
```

---

## 2. Core Rendering Architecture

### Component Hierarchy
```
Viewer.jsx
  └─ renderClipEl()
      ├─ SolidLayer
      ├─ ImageLayer
      ├─ VideoLayer
      ├─ TextLayer
      ├─ ShapeLayer
      ├─ AudioLayer
      └─ PrecompLayer ← NEW
          └─ PrecompRenderer
              └─ (recursive) renderClipEl() for child layers
```

### PrecompLayer Component Structure

Create: `src/components/Editor/Layers/PrecompLayer.jsx`

```jsx
/**
 * PrecompLayer.jsx
 * 
 * Renders a composition as a layer within another composition.
 * Uses FBO to render the precomp's layers to a texture,
 * then displays that texture as a plane.
 */

export default function PrecompLayer({ 
  id,
  clip,
  asset,              // The composition asset
  time,               // Parent composition time
  updatePropertyValue,
  setSelectedClipId,
  selectedClipId,
  projectId
}) {
  // 1. Calculate local time within precomp
  const localTime = calculatePrecompTime(time, clip, asset);
  
  // 2. Get clips belonging to this precomp
  const precompClips = useProjectStore(s => 
    Object.values(s.clips).filter(c => c.parentId === asset.id)
  );
  
  // 3. Render to FBO
  // 4. Display as textured plane
  // 5. Apply parent clip transforms
}
```

---

## 3. Time Calculation & Remapping

### Time Flow Through Precomp Hierarchy
```
Parent Time → Clip inPoint offset → Time Stretch → Time Remap → Loop/Clamp → Local Time
```

### Implementation

Create: `src/lib/precomp-utils.js`

```javascript
/**
 * Calculate the local time within a precomp based on parent time
 * and clip settings
 */
export function calculatePrecompTime(parentTime, clip, composition) {
  // 1. Apply clip's inPoint offset
  let t = parentTime - clip.inPoint;
  
  // Out of range check
  if (t < 0) return 0;
  
  // 2. Apply time stretch (playback speed)
  if (clip.timeStretch && clip.timeStretch !== 1.0) {
    t *= clip.timeStretch;
  }
  
  // 3. Apply time remapping (keyframed)
  if (clip.timeRemap?.keyframes?.length > 0) {
    t = evaluateProperty(clip.timeRemap, t);
  }
  
  // 4. Handle out-of-bounds based on loop mode
  const duration = composition.duration;
  if (t > duration) {
    switch (clip.loopMode || "clamp") {
      case "loop":
        t = t % duration;
        break;
      case "pingpong":
        const cycle = Math.floor(t / duration);
        const offset = t % duration;
        t = cycle % 2 === 0 ? offset : duration - offset;
        break;
      case "clamp":
      default:
        t = duration;
        break;
    }
  }
  
  return t;
}

/**
 * Prevent infinite recursion by detecting circular references
 */
export function detectCircularPrecomp(compId, targetCompId, clips, assets) {
  const visited = new Set();
  
  function traverse(currentCompId) {
    if (visited.has(currentCompId)) return true; // Circular!
    visited.add(currentCompId);
    
    // Get all clips in this composition
    const compClips = Object.values(clips).filter(c => c.parentId === currentCompId);
    
    // Check if any are precomps
    for (const clip of compClips) {
      if (clip.layerType === "precomp") {
        const childCompId = clip.sourceId;
        if (childCompId === targetCompId) return true;
        if (traverse(childCompId)) return true;
      }
    }
    
    visited.delete(currentCompId);
    return false;
  }
  
  return traverse(compId);
}
```

---

## 4. Rendering Implementation

### PrecompLayer.jsx - Full Implementation Pattern

Based on `MaskedLayer.jsx` architecture:

```jsx
import * as THREE from "three";
import { useThree, createPortal } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useFBO } from "@react-three/drei";
import { useProjectStore } from "@/stores/projectStore";
import { calculatePrecompTime } from "@/lib/precomp-utils";

export default function PrecompLayer({
  id,
  clip,
  asset,  // composition
  time,
  updatePropertyValue,
  setSelectedClipId,
  selectedClipId,
  projectId,
}) {
  const gl = useThree((s) => s.gl);
  const { clips, assets } = useProjectStore();
  
  // Calculate local time in precomp
  const localTime = calculatePrecompTime(time, clip, asset);
  
  // Create FBO for precomp rendering
  const precompRT = useFBO(asset.width, asset.height, {
    samples: 0,
    depthBuffer: true,
    stencilBuffer: false,
    format: THREE.RGBAFormat,
    type: THREE.UnsignedByteType,
  });
  precompRT.texture.colorSpace = THREE.NoColorSpace;
  
  // Isolated scene for precomp
  const precompScene = useMemo(() => new THREE.Scene(), []);
  
  // Camera matching precomp dimensions
  const precompCam = useMemo(() => {
    const cam = new THREE.PerspectiveCamera(
      40,
      asset.width / asset.height,
      0.1,
      10000
    );
    cam.position.set(asset.width / 2, asset.height / 2, -2666.6667);
    cam.rotation.set(Math.PI, 0, 0);
    cam.filmGauge = 36;
    cam.setFocalLength(50);
    cam.updateProjectionMatrix();
    return cam;
  }, [asset.width, asset.height]);
  
  // Get clips belonging to this precomp
  const precompClips = useMemo(() => {
    return Object.values(clips).filter(c => c.parentId === asset.id);
  }, [clips, asset.id]);
  
  // Filter active clips at current time
  const activeClips = useMemo(() => {
    return precompClips.filter(c => c.inPoint <= localTime);
  }, [precompClips, localTime]);
  
  useFrame(() => {
    // Render precomp to FBO
    const prevRT = gl.getRenderTarget();
    gl.setRenderTarget(precompRT);
    
    // Set background color
    const bg = asset.backgroundColor || { red: 0, green: 0, blue: 0 };
    const bgColor = new THREE.Color(bg.red, bg.green, bg.blue);
    bgColor.convertSRGBToLinear();
    gl.setClearColor(bgColor, 1);
    gl.clear(true, true, true);
    
    // Render precomp scene
    gl.render(precompScene, precompCam);
    
    gl.setRenderTarget(prevRT);
  });
  
  return (
    <>
      {/* Portal: render precomp's layers in isolated scene */}
      {createPortal(
        <group>
          <ambientLight intensity={1} />
          <pointLight position={[10, 10, 10]} />
          
          {activeClips
            .sort((a, b) => (b.index || 0) - (a.index || 0))
            .map(childClip => (
              <PrecompChildLayer
                key={childClip.id}
                clip={childClip}
                assets={assets}
                clips={clips}
                time={localTime}
                updatePropertyValue={updatePropertyValue}
                setSelectedClipId={setSelectedClipId}
                selectedClipId={selectedClipId}
                projectId={projectId}
              />
            ))}
        </group>,
        precompScene
      )}
      
      {/* Display precomp result as textured plane in parent scene */}
      <mesh position={[asset.width / 2, asset.height / 2, 0]} scale={[1, -1, 1]}>
        <planeGeometry args={[asset.width, asset.height]} />
        <meshBasicMaterial 
          map={precompRT.texture} 
          transparent 
          toneMapped={false}
          side={THREE.DoubleSide}
        />
      </mesh>
    </>
  );
}

/**
 * Helper component to render individual child layers within precomp
 * Handles recursive precomp nesting
 */
function PrecompChildLayer({ clip, assets, clips, time, ...props }) {
  const asset = assets[clip.sourceId];
  
  // Recursively handle nested precomps
  if (clip.layerType === "precomp") {
    return (
      <PrecompLayer
        id={clip.id}
        clip={clip}
        asset={asset}
        time={time}
        {...props}
      />
    );
  }
  
  // Render regular layer types
  // (Reuse existing layer components)
  const common = { 
    key: clip.id, 
    id: clip.id, 
    clip, 
    time, 
    asset,
    ...props 
  };
  
  switch (clip.layerType) {
    case "solid":
      return <SolidLayer {...common} solidItem={asset} />;
    case "image":
      return <ImageLayer {...common} />;
    case "video":
      return <VideoLayer {...common} />;
    case "text":
      return <TextLayer {...common} />;
    case "shape":
      return <ShapeLayer {...common} />;
    // Audio handled separately
    default:
      return null;
  }
}
```

---

## 5. Integration Points

### A. Viewer.jsx Modifications

```javascript
// In renderClipEl() function, add:
case "precomp":
  return (
    <PrecompLayer 
      {...common} 
      asset={assets[clip.sourceId]}
    />
  );
```

### B. ProjectStore.js Additions

```javascript
// Add helper method to get clips by composition
getClipsByComposition: (compId) => {
  const { clips } = get();
  return Object.values(clips).filter(c => c.parentId === compId);
},

// Add validation for circular references
validatePrecompReference: (currentCompId, targetCompId) => {
  const { clips, assets } = get();
  return !detectCircularPrecomp(currentCompId, targetCompId, clips, assets);
},
```

### C. Inspector Support

Create: `src/components/Editor/Inspector/PrecompInspector.jsx`

```jsx
import { useProjectStore } from "@/stores/projectStore";
import { useEditorStore } from "@/stores/editorStore";

export default function PrecompInspector() {
  const { assets, clips, updatePropertyValue } = useProjectStore();
  const { selectedClipId } = useEditorStore();
  
  const clip = clips[selectedClipId];
  const composition = assets[clip.sourceId];
  
  return (
    <div className="p-4 space-y-4">
      <div>
        <h3 className="font-semibold">Precomposition</h3>
        <p className="text-sm text-gray-600">{composition.name}</p>
      </div>
      
      <div>
        <label>Time Stretch</label>
        <input
          type="number"
          value={clip.timeStretch || 1.0}
          onChange={(e) => {
            // Update time stretch
          }}
          step="0.1"
          min="0.1"
          max="10"
        />
      </div>
      
      <div>
        <label>Loop Mode</label>
        <select 
          value={clip.loopMode || "clamp"}
          onChange={(e) => {
            // Update loop mode
          }}
        >
          <option value="clamp">Clamp</option>
          <option value="loop">Loop</option>
          <option value="pingpong">Ping Pong</option>
        </select>
      </div>
      
      <div>
        <button onClick={() => {
          // Navigate to composition (switch activeCompId)
        }}>
          Edit Precomp
        </button>
      </div>
    </div>
  );
}
```

Update `Inspector.jsx`:
```javascript
case "precomp":
  return <PrecompInspector />;
```

---

## 6. Performance Optimizations

### A. Render Caching
```javascript
// Cache precomp renders when time hasn't changed
const lastTime = useRef(null);
const cachedTexture = useRef(null);

useFrame(() => {
  // Only re-render if time changed
  if (lastTime.current === localTime && cachedTexture.current) {
    return; // Use cached texture
  }
  
  lastTime.current = localTime;
  // ... render logic
});
```

### B. Lazy Rendering
```javascript
// Only render precomps that are visible/active
const isVisible = useMemo(() => {
  return clip.inPoint <= time && time < clip.outPoint;
}, [clip, time]);

if (!isVisible) {
  return null; // Don't render off-screen precomps
}
```

### C. Depth Limiting
```javascript
const MAX_PRECOMP_DEPTH = 10;

function PrecompLayer({ depth = 0, ...props }) {
  if (depth >= MAX_PRECOMP_DEPTH) {
    console.warn("Max precomp nesting depth reached");
    return null;
  }
  
  return (
    <PrecompChildLayer depth={depth + 1} {...props} />
  );
}
```

---

## 7. Edge Cases & Challenges

### A. Circular References
**Problem**: Comp A contains Comp B, which contains Comp A  
**Solution**: Detect and prevent in `validatePrecompReference()`

### B. Different Frame Rates
**Problem**: Parent comp 25fps, precomp 30fps  
**Solution**: Time calculation handles this naturally (use absolute time, not frames)

### C. Different Dimensions
**Problem**: 1920x1080 precomp in 1280x720 parent  
**Solution**: FBO renders at precomp's native size, parent scales the resulting plane

### D. Audio in Precomps
**Problem**: Audio layers need time offset and volume mixing  
**Solution**: Pass time offset down, audio layers handle their own timing

### E. Transform Inheritance
**Problem**: Parent layer transform + precomp layer transform  
**Solution**: Precomp renders in its own space, parent applies transforms to result plane

### F. Effects on Precomps
**Problem**: Apply blur to entire precomp output  
**Solution**: Effects applied to precomp layer work on FBO texture (already supported by Compositor2D)

---

## 8. Implementation Phases

### Phase 1: MVP (Basic Precomp Support)
- [ ] Create `PrecompLayer.jsx` with basic FBO rendering
- [ ] Add `case "precomp"` to `Viewer.jsx`
- [ ] Implement `calculatePrecompTime()` (simple offset)
- [ ] Test single-level precomp (no nesting)
- [ ] Verify transforms work on precomp layer

**Success Criteria**: Can place composition as layer in parent, renders correctly

### Phase 2: Time & Playback
- [ ] Implement time stretch
- [ ] Add loop modes (clamp, loop, pingpong)
- [ ] Handle out-of-bounds time correctly
- [ ] Test with different frame rates

**Success Criteria**: Time-based playback control works correctly

### Phase 3: Recursive Nesting
- [ ] Enable nested precomps (precomp within precomp)
- [ ] Implement circular reference detection
- [ ] Add depth limiting
- [ ] Test 3+ levels of nesting

**Success Criteria**: Multi-level precomp nesting works without crashes

### Phase 4: Inspector & UI
- [ ] Create `PrecompInspector.jsx`
- [ ] Add composition selector in AssetList
- [ ] Implement "Edit Precomp" navigation
- [ ] Show precomp indicator in timeline

**Success Criteria**: Can inspect and edit precomp properties via UI

### Phase 5: Advanced Features
- [ ] Time remapping (keyframed time)
- [ ] Render caching for performance
- [ ] Collapse transformations optimization
- [ ] Audio handling in precomps
- [ ] Precomp markers/guides

**Success Criteria**: Production-ready precomp system

### Phase 6: Polish & Testing
- [ ] Edge case handling
- [ ] Performance profiling
- [ ] Memory leak prevention
- [ ] Documentation
- [ ] Unit tests

**Success Criteria**: Stable, performant, well-documented

---

## 9. Testing Strategy

### Unit Tests
```javascript
// precomp-utils.test.js
describe("calculatePrecompTime", () => {
  it("applies inPoint offset", () => {
    const result = calculatePrecompTime(5, { inPoint: 2 }, { duration: 10 });
    expect(result).toBe(3);
  });
  
  it("handles time stretch", () => {
    const result = calculatePrecompTime(4, { inPoint: 0, timeStretch: 0.5 }, { duration: 10 });
    expect(result).toBe(2);
  });
  
  it("loops correctly", () => {
    const result = calculatePrecompTime(12, { inPoint: 0, loopMode: "loop" }, { duration: 10 });
    expect(result).toBe(2);
  });
});

describe("detectCircularPrecomp", () => {
  it("detects simple circular reference", () => {
    const clips = {
      "clip1": { parentId: "comp1", layerType: "precomp", sourceId: "comp2" },
      "clip2": { parentId: "comp2", layerType: "precomp", sourceId: "comp1" },
    };
    expect(detectCircularPrecomp("comp1", "comp2", clips, {})).toBe(true);
  });
});
```

### Integration Tests
- Render single precomp
- Render nested precomp (2 levels)
- Apply effects to precomp layer
- Animate precomp layer properties
- Test with 3D layers inside precomp
- Test track mattes on precomp layers

### Manual Test Cases
1. Create precomp with text + shape layers
2. Add precomp to main composition
3. Animate precomp position/scale/rotation
4. Change time stretch to 0.5x
5. Set loop mode to loop
6. Apply blur effect to precomp layer
7. Create nested precomp (3 levels deep)
8. Test with different comp dimensions
9. Verify audio playback timing

---

## 10. File Checklist

### New Files to Create
- [ ] `src/components/Editor/Layers/PrecompLayer.jsx`
- [ ] `src/components/Editor/Inspector/PrecompInspector.jsx`
- [ ] `src/lib/precomp-utils.js`
- [ ] `src/lib/precomp-utils.test.js` (if testing)

### Files to Modify
- [ ] `src/components/Editor/Viewer.jsx` - Add precomp case
- [ ] `src/components/Editor/Inspector.jsx` - Add precomp inspector case
- [ ] `src/stores/projectStore.js` - Add helper methods
- [ ] Import statements in relevant files

### Files to Reference (Don't Modify)
- ✓ `src/components/Editor/Layers/MaskedLayer.jsx` - FBO pattern reference
- ✓ `src/components/Editor/Compositor2D.jsx` - Compositing reference
- ✓ `src/components/Editor/Layers/VideoLayer.jsx` - Asset layer pattern
- ✓ `src/lib/project-utils.js` - Existing utilities

---

## 11. Future Enhancements

### Advanced Features (Post-MVP)
- **Collapse Transformations**: Bake parent transform into children for performance
- **Motion Blur**: Respect motion blur settings through precomp hierarchy
- **Precomp Proxies**: Use lower-resolution version for editing, full-res for render
- **Time Markers**: Display precomp markers in parent timeline
- **Layer Styles**: Propagate layer styles (drop shadow, glow) through precomps
- **Smart Caching**: Intelligent cache invalidation based on dirty flags
- **Precomp Templates**: Save precomps as reusable templates
- **Color Management**: Handle color space through precomp chain

### UI/UX Improvements
- Breadcrumb navigation (Main > Precomp1 > Precomp2)
- Visual precomp nesting indicator in timeline
- Thumbnail preview of precomp in asset list
- "Reveal in Precomp" to jump to nested layer
- Precomp usage tracking (show where comp is used)
- Drag composition from AssetList to timeline to create precomp layer

---

## 12. Resources & References

### Similar Implementations
- **After Effects**: Gold standard for precomp behavior
- **Blender**: Compositor nodes (similar concept)
- **Nuke**: Precomps/groups in node graph

### Technical References
- Three.js FBO Documentation
- React Three Fiber createPortal
- WebGL render target best practices

### Code References in This Project
- `MaskedLayer.jsx` (lines 1-159) - Portal + FBO pattern
- `Compositor2D.jsx` (lines 1-239) - Layer compositing
- `Viewer.jsx` (lines 17-144) - Layer rendering loop
- `projectStore.js` (lines 1-237) - State management

---

## Summary

Precomposition support builds naturally on our existing architecture:
- **FBO rendering** ✓ Already proven with MaskedLayer
- **Portal isolation** ✓ Already working
- **Asset-clip model** ✓ Compositions are already assets
- **Recursive rendering** ✓ Pattern established

The implementation follows these key principles:
1. **Isolation**: Each precomp renders in its own scene/FBO
2. **Recursion**: Precomps can contain precomps (with safeguards)
3. **Time mapping**: Local time calculated from parent time + clip properties
4. **Transform separation**: Precomp renders in its space, parent transforms result
5. **Composition**: Precomp result treated as single layer in parent compositor

Start with Phase 1 MVP to validate the approach, then iterate through phases to add sophistication. The architecture is sound and should scale well to complex nested compositions.



