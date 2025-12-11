// MaskedLayer.jsx
import * as THREE from "three";
import { useThree, createPortal } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useFBO } from "@react-three/drei";

/**
 * Props:
 *  - compWidth, compHeight: composition dimensions in pixels (FBO size)
 *  - width, height: layer/asset dimensions in pixels (for content positioning)
 *  - mode: 'alpha' | 'luma'
 *  - invert: boolean
 *  - children: content to be masked (rendered to colorRT)
 *  - mask: mask geometry (rendered to maskRT as white on black)
 *  - transform: { position, scale, rotation, anchorPoint } - applied inside FBO scenes
 */
export default function MaskedLayer({ compWidth, compHeight, width, height, mode = "alpha", invert = false, children, mask, transform }) {
    const gl = useThree((s) => s.gl);

    // Use comp dimensions for FBOs to render at output resolution
    const fboWidth = compWidth || width;
    const fboHeight = compHeight || height;

    // --- Render targets at comp resolution
    const colorRT = useFBO(fboWidth, fboHeight, {
        samples: 0,
        depthBuffer: false,
        stencilBuffer: false,
        format: THREE.RGBAFormat,
        type: THREE.UnsignedByteType,
    });
    // Store raw linear color in offscreen buffers (equivalent to Canvas flat)
    colorRT.texture.colorSpace = THREE.NoColorSpace;

    const maskRT = useFBO(fboWidth, fboHeight, {
        samples: 0,
        depthBuffer: false,
        stencilBuffer: false,
        format: THREE.RGBAFormat, // Broad compatibility across WebGL1/2
        type: THREE.UnsignedByteType,
    });
    maskRT.texture.colorSpace = THREE.NoColorSpace;

    // --- Scenes + ortho camera in pixel space (comp dimensions)
    const contentScene = useMemo(() => new THREE.Scene(), []);
    const maskScene = useMemo(() => new THREE.Scene(), []);

    const cam = useMemo(() => {
        // Ortho camera in pixel space: (0,0) bottom-left → (fboWidth, fboHeight) top-right
        const c = new THREE.OrthographicCamera(0, fboWidth, 0, fboHeight, 0.1, 1000);
        c.position.set(0, 0, 10);
        c.updateProjectionMatrix();
        return c;
    }, [fboWidth, fboHeight]);

    // --- Fullscreen quad in main scene that composites the RTs
    const matRef = useRef();

    const shaderMat = useMemo(() => {
        return new THREE.ShaderMaterial({
            uniforms: {
                tColor: { value: colorRT.texture },
                tMask: { value: maskRT.texture },
                uMode: { value: mode === "luma" ? 1 : 0 },
                uInvert: { value: invert ? 1 : 0 },
            },
            transparent: true,
            depthWrite: false,
            depthTest: false,
            side: THREE.DoubleSide,
            toneMapped: false,
            premultipliedAlpha: false,
            vertexShader: `
        varying vec2 vUv;
        void main(){
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
        }
      `,
            fragmentShader: `
        #include <common>
        uniform sampler2D tColor;
        uniform sampler2D tMask;
        uniform int uMode;   // 0=alpha, 1=luma
        uniform int uInvert; // 0=normal, 1=invert
        varying vec2 vUv;

        float luma(vec3 c){ return dot(c, vec3(0.299, 0.587, 0.114)); }

        void main(){
          vec4 col = texture2D(tColor, vUv);
          vec4 maskSample = texture2D(tMask, vUv);
          float m;
          if(uMode == 1){
              // Luma matte: use luminance from mask texture (RGB)
              m = luma(maskSample.rgb);
          } else {
              // Alpha matte: use mask alpha channel
              m = maskSample.a;
          }
          if(uInvert == 1) m = 1.0 - m;

          // Apply mask to alpha only, keep RGB unchanged
          gl_FragColor = vec4(col.rgb, col.a * m);
          #include <colorspace_fragment>
        }
      `,
        });
    }, [colorRT, maskRT, mode, invert]);

    // --- Render loop
    useFrame(() => {
        // Render CONTENT to colorRT
        const prevRT = gl.getRenderTarget();
        gl.setRenderTarget(colorRT);
        gl.setClearColor(0x000000, 0);
        gl.clear(true, true, true);
        gl.render(contentScene, cam);

        // Render MASK to maskRT (black background, white mask)
        gl.setRenderTarget(maskRT);
        gl.setClearColor(0x000000, 0);
        gl.clear(true, true, true);
        gl.render(maskScene, cam);

        gl.setRenderTarget(prevRT);
        // Ensure shader sees the latest textures
        matRef.current && (matRef.current.uniforms.tColor.value = colorRT.texture);
        matRef.current && (matRef.current.uniforms.tMask.value = maskRT.texture);
    });

    // Build transform group props from transform object
    const transformGroupProps = transform
        ? {
              position: [transform.position.x, transform.position.y, transform.position.z],
              scale: [transform.scale.x, transform.scale.y, transform.scale.z],
              rotation: [Math.PI * (transform.rotation.x / 180), Math.PI * (transform.rotation.y / 180), Math.PI * (transform.rotation.z / 180)],
          }
        : {};

    const anchorOffset = transform ? [-transform.anchorPoint.x, -transform.anchorPoint.y, -transform.anchorPoint.z] : [0, 0, 0];

    return (
        <>
            {/* Portals: render children & mask in their own scenes with transforms applied */}
            {createPortal(
                <group {...transformGroupProps}>
                    <group position={anchorOffset}>{children}</group>
                </group>,
                contentScene
            )}
            {createPortal(
                <group {...transformGroupProps}>
                    <group position={anchorOffset}>{mask}</group>
                </group>,
                maskScene
            )}

            {/* Composite output in main scene: full-comp quad (transforms already applied inside FBOs) */}
            <mesh position={[fboWidth / 2, fboHeight / 2, 0]} scale={[1, -1, 1]}>
                <planeGeometry args={[fboWidth, fboHeight]} />
                <primitive object={shaderMat} attach="material" ref={matRef} />
            </mesh>
        </>
    );
}
