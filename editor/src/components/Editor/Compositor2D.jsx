import * as THREE from "three";
import { useThree, useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { useFBO } from "@react-three/drei";
import EffectRunner from "@/lib/effects/EffectRunner";

export default function Compositor2D({
    width,
    height,
    time,
    mainScene, // THREE.Scene or ref
    camera, // THREE.Camera or ref
    orderedLayers, // [{ id, groupRef, opacity }]
}) {
    const gl = useThree((s) => s.gl);

    const rtOpts = useMemo(
        () => ({
            width,
            height,
            depthBuffer: false,
            stencilBuffer: false,
            format: THREE.RGBAFormat,
            type: THREE.UnsignedByteType,
        }),
        [width, height]
    );

    const A = useFBO(rtOpts);
    const B = useFBO(rtOpts);
    // 2D layer capture (no depth)
    const L2D = useFBO({ ...rtOpts, depthBuffer: false });
    // 3D group capture (with depth)
    const L3D = useFBO({ ...rtOpts, depthBuffer: true });

    // Ensure linear intermediates (straight alpha)
    A.texture.colorSpace = THREE.NoColorSpace;
    B.texture.colorSpace = THREE.NoColorSpace;
    L2D.texture.colorSpace = THREE.NoColorSpace;
    L3D.texture.colorSpace = THREE.NoColorSpace;

    // Quad scene for compositing
    const quadScene = useMemo(() => new THREE.Scene(), []);
    const quadCam = useMemo(() => new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), []);
    const quadMesh = useMemo(() => {
        const geo = new THREE.PlaneGeometry(2, 2);
        const mat = new THREE.ShaderMaterial({
            depthTest: false,
            depthWrite: false,
            transparent: true,
            toneMapped: false,
            premultipliedAlpha: false,
            vertexShader: `
                varying vec2 vUv;
                void main() {
                  vUv = position.xy * 0.5 + 0.5;
                  gl_Position = vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                precision highp float;
                varying vec2 vUv;
                uniform sampler2D uBase;
                uniform sampler2D uLayer;
                uniform float uOpacity;
                uniform int uBlendMode; // 0=normal,1=multiply,2=screen,3=overlay,4=add,5=darken,6=lighten

                vec3 blendNormal(vec3 b, vec3 l) { return l; }
                vec3 blendMultiply(vec3 b, vec3 l) { return b * l; }
                vec3 blendScreen(vec3 b, vec3 l) { return 1.0 - (1.0 - b) * (1.0 - l); }
                vec3 blendOverlay(vec3 b, vec3 l) {
                  vec3 lt = step(b, vec3(0.5));
                  vec3 a = 2.0 * b * l;
                  vec3 b2 = 1.0 - 2.0 * (1.0 - b) * (1.0 - l);
                  return mix(b2, a, lt);
                }
                vec3 blendAdd(vec3 b, vec3 l) { return min(b + l, 1.0); }
                vec3 blendDarken(vec3 b, vec3 l) { return min(b, l); }
                vec3 blendLighten(vec3 b, vec3 l) { return max(b, l); }
                vec3 applyBlend(int mode, vec3 b, vec3 l){
                  if(mode==1) return blendMultiply(b,l);
                  if(mode==2) return blendScreen(b,l);
                  if(mode==3) return blendOverlay(b,l);
                  if(mode==4) return blendAdd(b,l);
                  if(mode==5) return blendDarken(b,l);
                  if(mode==6) return blendLighten(b,l);
                  return blendNormal(b,l);
                }
                void main(){
                  vec4 base = texture2D(uBase, vUv);
                  vec4 lay  = texture2D(uLayer, vUv);
                  
                  // Unpremultiply the layer (convert from premultiplied to straight alpha)
                  vec3 layRGB = lay.a > 0.001 ? lay.rgb / lay.a : vec3(0.0);
                  
                  float a = clamp(lay.a * uOpacity, 0.0, 1.0);
                  vec3 blended = applyBlend(uBlendMode, base.rgb, layRGB);
                  vec3 outRGB = mix(base.rgb, blended, a);
                  float outA  = a + base.a * (1.0 - a);
                  gl_FragColor = vec4(outRGB, outA);
                }
            `,
            uniforms: {
                uBase: { value: null },
                uLayer: { value: null },
                uOpacity: { value: 1.0 },
                uBlendMode: { value: 0 },
            },
        });
        const m = new THREE.Mesh(geo, mat);
        quadScene.add(m);
        return m;
    }, [quadScene]);

    const finalTexRef = useRef(A.texture);
    const finalMeshRef = useRef();
    const runnerRef = useRef(null);

    useFrame(() => {
        const sceneObj = mainScene?.current || mainScene;
        const camObj = camera?.current || camera;
        if (!sceneObj || !camObj) return;

        // Lazy create EffectRunner and sync size
        if (!runnerRef.current) {
            runnerRef.current = new EffectRunner(gl, width, height);
        } else {
            runnerRef.current.setSize(width, height);
        }

        // 1) Clear base A to transparent
        gl.setRenderTarget(A);
        gl.setClearColor(0x000000, 0);
        gl.clear(true, true, true);

        let base = A;
        let out = B;

        // Helper to set all layer groups invisible
        const setAllInvisible = () => {
            for (let i = 0; i < (orderedLayers?.length || 0); i++) {
                const g = orderedLayers[i].groupRef?.current || orderedLayers[i].groupRef;
                if (g) g.visible = false;
            }
        };

        setAllInvisible();
        // Hide compositor output while capturing layers
        if (finalMeshRef.current) finalMeshRef.current.visible = false;

        // 2) Composite bottom→top
        // Blend mode mapping
        const BLEND_MAP = { normal: 0, multiply: 1, screen: 2, overlay: 3, add: 4, darken: 5, lighten: 6 };

        for (let i = 0; i < (orderedLayers?.length || 0); i++) {
            const entry = orderedLayers[i];
            const hasGroupMembers = Array.isArray(entry.memberRefs) && entry.memberRefs.length > 0;
            const singleGroup = entry.groupRef?.current || entry.groupRef;

            if (hasGroupMembers) {
                // show all members
                for (let k = 0; k < entry.memberRefs.length; k++) {
                    const g = entry.memberRefs[k]?.current || entry.memberRefs[k];
                    if (g) g.visible = true;
                }
                // render 3D group with depth
                gl.setRenderTarget(L3D);
                gl.setClearColor(0x000000, 0);
                gl.clear(true, true, true);
                const prevBackground = sceneObj.background;
                sceneObj.background = null;
                gl.render(sceneObj, camObj);
                sceneObj.background = prevBackground;
                // composite base + L3D -> out
                quadMesh.material.uniforms.uLayer.value = L3D.texture;
            } else {
                if (!singleGroup) continue;
                // show only this layer
                singleGroup.visible = true;
                // render 2D layer without depth
                gl.setRenderTarget(L2D);
                gl.setClearColor(0x000000, 0);
                gl.clear(true, true, true);
                const prevBackground = sceneObj.background;
                sceneObj.background = null;
                gl.render(sceneObj, camObj);
                sceneObj.background = prevBackground;
                // Run EffectRunner on this layer's texture if there are effects
                const effects = entry.effects || [];
                const tex = effects.length > 0 ? runnerRef.current.run({ texture: L2D.texture, width, height, effects, time }) : L2D.texture;
                // composite base + processed layer -> out
                quadMesh.material.uniforms.uLayer.value = tex;
            }

            // composite base + L -> out
            quadMesh.material.uniforms.uBase.value = base.texture;
            quadMesh.material.uniforms.uOpacity.value = entry.opacity ?? 1.0;
            const blendKey = (entry.blendMode || entry.blend || "normal").toLowerCase();
            quadMesh.material.uniforms.uBlendMode.value = BLEND_MAP[blendKey] ?? 0;

            gl.setRenderTarget(out);
            gl.clear(true, true, true);
            gl.render(quadScene, quadCam);

            // hide again
            if (hasGroupMembers) {
                for (let k = 0; k < entry.memberRefs.length; k++) {
                    const g = entry.memberRefs[k]?.current || entry.memberRefs[k];
                    if (g) g.visible = false;
                }
            } else if (singleGroup) {
                singleGroup.visible = false;
            }

            // swap base<->out
            const tmp = base;
            base = out;
            out = tmp;
        }

        // 3) Present final
        gl.setRenderTarget(null);
        finalTexRef.current = base.texture;
        // Update output material map and show the plane
        if (finalMeshRef.current) {
            const mat = finalMeshRef.current.material;
            if (mat.map !== base.texture) {
                mat.map = base.texture;
                mat.needsUpdate = true;
            }
            finalMeshRef.current.visible = true;
        }
    });

    // Present final texture in pixel space
    return (
        <mesh position={[width / 2, height / 2, 0]} scale={[1, -1, 1]} ref={finalMeshRef}>
            <planeGeometry args={[width, height]} />
            <meshBasicMaterial map={finalTexRef.current} transparent toneMapped={false} side={THREE.DoubleSide} />
        </mesh>
    );
}
